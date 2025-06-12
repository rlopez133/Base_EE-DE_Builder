import React from 'react';
import { AlertActionCloseButton } from '@patternfly/react-core';
import {
  Page,
  PageSection,
  Title,
  Card,
  CardTitle,
  CardBody,
  Button,
  Text,
  Grid,
  GridItem,
  Label,
  Modal,
  ModalVariant,
  Form,
  FormGroup,
  TextInput,
  ActionGroup,
  Alert,
  Checkbox,
  Progress,
  ProgressSize,
  Spinner,
  Tabs,
  Tab,
  TabTitleText,
  ExpandableSection,
  Badge,
  Split,
  SplitItem,
  Flex,
  FlexItem,
  TextArea,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Divider
} from '@patternfly/react-core';
import { 
  BuilderImageIcon, 
  CubesIcon, 
  PlayIcon, 
  SyncIcon, 
  InfoCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TimesCircleIcon,
  ClockIcon,
  PlusCircleIcon,
  CodeIcon,
  PficonTemplateIcon,
  StopIcon,
  ExclamationCircleIcon,
  DisconnectedIcon,
  KeyIcon
} from '@patternfly/react-icons';

interface Environment {
  name: string;
  description: string;
  type: string; // ee, de, devtools, template
  os_version: string;
  variant: string;
  base_image: string;
  status: string;
  python_deps: string[];
  ansible_collections: string[];
  system_deps: string[];
  build_args: any;
  file_size_mb?: number;
  template_type: string; // "1-file" or "4-file"
}

interface EnvironmentDetails {
  environment: Environment;
  execution_environment_yml: any;
  requirements_txt: string[];
  requirements_yml: any;
  bindep_txt: string[];
  files_info: any;
}

interface Build {
  id: string;
  status: string;
  environments: string[];
  started_at: string;
  completed_at?: string;
  logs: string[];
  images: string[];
  errors: string[];
  build_time_seconds?: number;
}

interface DashboardStats {
  ready_to_build: number;
  build_issues: {
    count: number;
    details: Array<{
      environment: string;
      issue: string;
      severity: string;
    }>;
  };
  large_images: {
    count: number;
    details: Array<{
      environment: string;
      estimated_size_mb: number;
    }>;
  };
  recently_updated: {
    count: number;
    details: Array<{
      environment: string;
      modified: string;
      days_ago: number;
    }>;
  };
  currently_building: {
    count: number;
    details: Array<{
      build_id: string;
      environments: string[];
      started: string;
      duration_minutes: number;
    }>;
  };
  success_rate: {
    percentage: number;
    successful_builds: number;
    total_builds: number;
    period_days: number;
  };
  last_updated: string;
  error?: string;
}

// New interfaces for Custom EE Wizard
interface BaseImage {
  name: string;
  description: string;
  type: string;
  os: string;
}

interface PackageTemplates {
  python_packages: Record<string, string[]>;
  system_packages: Record<string, string[]>;
  ansible_collections: Record<string, string[]>;
}

interface CustomEEForm {
  name: string;
  description: string;
  base_image: string;
  custom_base_image: string;
  use_custom_base_image: boolean;
  python_packages: string[];
  system_packages: string[];
  ansible_collections: string[];
  additional_build_steps: string;
  // New fields for YAML import mode
  import_mode: 'wizard' | 'yaml' | '';
  yaml_content: string;
}

const App: React.FC = () => {
  const [environments, setEnvironments] = React.useState<Environment[]>([]);
  const [selectedEnvs, setSelectedEnvs] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);
  const [isCustomEEModalOpen, setIsCustomEEModalOpen] = React.useState(false);
  const [isBuildModalOpen, setIsBuildModalOpen] = React.useState(false);
  const [isRHAuthModalOpen, setIsRHAuthModalOpen] = React.useState(false);
  const [selectedEnvDetails, setSelectedEnvDetails] = React.useState<EnvironmentDetails | null>(null);
  const [dashboardStats, setDashboardStats] = React.useState<DashboardStats | null>(null);
  const [building, setBuilding] = React.useState(false);
  const [buildResult, setBuildResult] = React.useState<{type: 'success' | 'danger' | 'warning' | 'info', message: string} | null>(null);
  const [currentBuild, setCurrentBuild] = React.useState<Build | null>(null);
  const [activeTab, setActiveTab] = React.useState<string | number>(0);
  const [filterType, setFilterType] = React.useState<string>('all');
  const [filterOS, setFilterOS] = React.useState<string>('all');
  const [filterTemplateType, setFilterTemplateType] = React.useState<string>('all');
  const [buildDebugInfo, setBuildDebugInfo] = React.useState<string>('');
  const [connectionStatus, setConnectionStatus] = React.useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [retryCount, setRetryCount] = React.useState<number>(0);
  
  // Red Hat Authentication State
  const [rhCredentials, setRHCredentials] = React.useState({
    username: '',
    password: ''
  });
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [rhAuthStatus, setRHAuthStatus] = React.useState<'none' | 'authenticated' | 'failed'>('none');
  const [rhUsername, setRHUsername] = React.useState<string>('');
  
  // Add these new state variables for Custom EE Wizard:
  const [isCustomEEWizardOpen, setIsCustomEEWizardOpen] = React.useState(false);
  const [customEEStep, setCustomEEStep] = React.useState(0);
  const [availableBaseImages, setAvailableBaseImages] = React.useState<Record<string, BaseImage>>({});
  const [packageTemplates, setPackageTemplates] = React.useState<PackageTemplates | null>(null);
  const [customEEForm, setCustomEEForm] = React.useState<CustomEEForm>({
    name: '',
    description: '',
    base_image: '',
    custom_base_image: '',
    use_custom_base_image: false,
    python_packages: [],
    system_packages: [],
    ansible_collections: [],
    additional_build_steps: '',
    import_mode: '',
    yaml_content: ''
  });

  // Enhanced API call with better error handling
  const apiCall = async (url: string, options?: RequestInit): Promise<any> => {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setConnectionStatus('connected');
      setRetryCount(0);
      return data;
    } catch (error: any) {
      console.error(`API call failed for ${url}:`, error);
      
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
        setConnectionStatus('disconnected');
      }
      
      throw error;
    }
  };

  // Add these new functions for Custom EE Wizard:
  const loadCustomEEData = async () => {
    try {
      const [baseImagesResponse, templatesResponse] = await Promise.all([
        apiCall('/api/custom-ee/base-images'),
        apiCall('/api/custom-ee/templates')
      ]);
      
      setAvailableBaseImages(baseImagesResponse.base_images);
      
      // Use safe, tested templates if backend doesn't provide them
      const safeTemplates = templatesResponse || {
        python_packages: {
          "basic_automation": ["pyyaml", "jinja2", "python-dateutil"],
          "web_requests": ["requests", "urllib3"],
          "data_processing": ["pandas", "numpy"],
          "web_scraping": ["requests", "beautifulsoup4", "lxml"],
          "system_monitoring": ["psutil", "systemd-python"]
        },
        system_packages: {
          "basic_tools": ["git", "curl", "wget"],
          "development_tools": ["gcc", "make", "python3-devel"],
          "openshift_tools": ["openshift-clients"],
          "kubernetes_tools": ["kubectl"]
        },
        ansible_collections: {
          "core_collections": ["ansible.posix", "community.general"],
          "cloud_providers": ["amazon.aws", "azure.azcollection"],
          "kubernetes_automation": ["kubernetes.core", "redhat.openshift"]
        }
      };
      
      setPackageTemplates(safeTemplates);
    } catch (err) {
      console.error('Failed to load custom EE data:', err);
      
      // Fallback to safe templates on error
      setPackageTemplates({
        python_packages: {
          "basic_automation": ["pyyaml", "jinja2", "python-dateutil"],
          "web_requests": ["requests", "urllib3"],
          "data_processing": ["pandas", "numpy"]
        },
        system_packages: {
          "basic_tools": ["git", "curl", "wget"],
          "development_tools": ["gcc", "make", "python3-devel"]
        },
        ansible_collections: {
          "core_collections": ["ansible.posix", "community.general"]
        }
      });
    }
  };

  const addPackageFromTemplate = (type: 'python_packages' | 'system_packages' | 'ansible_collections', template: string) => {
    if (!packageTemplates) return;
    
    const packages = packageTemplates[type][template] || [];
    setCustomEEForm(prev => ({
      ...prev,
      [type]: Array.from(new Set([...prev[type], ...packages])) // Remove duplicates
    }));
  };

  const addCustomPackage = (type: 'python_packages' | 'system_packages' | 'ansible_collections', packageName: string) => {
    if (!packageName.trim()) return;
    
    setCustomEEForm(prev => ({
      ...prev,
      [type]: Array.from(new Set([...prev[type], packageName.trim()]))
    }));
  };

  const removePackage = (type: 'python_packages' | 'system_packages' | 'ansible_collections', packageName: string) => {
    setCustomEEForm(prev => ({
      ...prev,
      [type]: prev[type].filter(pkg => pkg !== packageName)
    }));
  };

  const createCustomEE = async () => {
    // For YAML mode, we just need the name and raw YAML content
    if (customEEForm.import_mode === 'yaml') {
      // Check Red Hat registry authentication if needed (for the validation logic)
      const extractedBaseImage = extractBaseImageFromYAML(customEEForm.yaml_content);
      if (extractedBaseImage?.includes('registry.redhat.io') && rhAuthStatus !== 'authenticated') {
        setBuildResult({ 
          type: 'warning', 
          message: 'Red Hat registry authentication required. Please login first.' 
        });
        setIsRHAuthModalOpen(true);
        return;
      }

      // For YAML mode, send the name and raw YAML content
      const yamlImportData = {
        name: customEEForm.name,
        import_mode: 'yaml',
        yaml_content: customEEForm.yaml_content,
        build_immediately: true
      };

      try {
        const response = await apiCall('/api/custom-ee/create', {
          method: 'POST',
          body: JSON.stringify(yamlImportData)
        });

        if (response.success) {
          setBuildResult({ 
            type: 'success', 
            message: `✅ ${response.message}${response.build_id ? ` Build started: ${response.build_id}` : ''}` 
          });
          
          setIsCustomEEWizardOpen(false);
          resetCustomEEForm();
          
          // Reload environments to show the new one
          await loadEnvironments();
          
          // Since we always build, open build modal and start polling
          if (response.build_id) {
            setCurrentBuild({
              id: response.build_id,
              status: 'starting',
              environments: [customEEForm.name],
              started_at: new Date().toISOString(),
              logs: ['🚀 Custom EE build started...'],
              images: [],
              errors: []
            });
            setBuilding(true);
            setIsBuildModalOpen(true);
            pollBuildStatus(response.build_id);
          }
        } else {
          setBuildResult({ 
            type: 'danger', 
            message: `❌ ${response.message}` 
          });
        }
      } catch (err: any) {
        setBuildResult({ type: 'danger', message: `❌ Failed to create custom EE: ${err.message}` });
      }
      return;
    }

    // For wizard mode, check Red Hat registry authentication before proceeding
    const finalBaseImage = customEEForm.use_custom_base_image ? 
      customEEForm.custom_base_image : 
      customEEForm.base_image;
    
    if (finalBaseImage?.includes('registry.redhat.io') && rhAuthStatus !== 'authenticated') {
      setBuildResult({ 
        type: 'warning', 
        message: 'Red Hat registry authentication required. Please login first.' 
      });
      setIsRHAuthModalOpen(true);
      return;
    }

    try {
      const response = await apiCall('/api/custom-ee/create', {
        method: 'POST',
        body: JSON.stringify({
          ...customEEForm,
          build_immediately: true // Always build when using the wizard
        })
      });

      if (response.success) {
        setBuildResult({ 
          type: 'success', 
          message: `✅ ${response.message}${response.build_id ? ` Build started: ${response.build_id}` : ''}` 
        });
        
        setIsCustomEEWizardOpen(false);
        resetCustomEEForm(); // Use the reset function
        
        // Reload environments to show the new one
        await loadEnvironments();
        
        // Since we always build, open build modal and start polling
        if (response.build_id) {
          setCurrentBuild({
            id: response.build_id,
            status: 'starting',
            environments: [customEEForm.name],
            started_at: new Date().toISOString(),
            logs: ['🚀 Custom EE build started...'],
            images: [],
            errors: []
          });
          setBuilding(true);
          setIsBuildModalOpen(true);
          pollBuildStatus(response.build_id);
        }
      } else {
        setBuildResult({ 
          type: 'danger', 
          message: `❌ ${response.message}${response.message.includes('dependencies') ? 
            ' - Try adding required system packages or removing problematic Python packages.' : ''}` 
        });
      }
    } catch (err: any) {
      const errorMessage = err.message.includes('metadata-generation-failed') || err.message.includes('package') ?
        `❌ Failed to create custom EE: ${err.message} - This may be due to missing system dependencies. Try adding development packages like 'gcc', 'python3-dev' in Step 2.` :
        `❌ Failed to create custom EE: ${err.message}`;
      setBuildResult({ type: 'danger', message: errorMessage });
    }
  };

  const getStepTitle = (step: number) => {
    if (customEEForm.import_mode === 'yaml') {
      switch (step) {
        case 0: return 'Import YAML Configuration';
        case 1: return 'Review & Create';
        default: return 'Custom EE Import';
      }
    } else {
      switch (step) {
        case 0: return 'Basic Information';
        case 1: return 'Python Packages';
        case 2: return 'System Packages';
        case 3: return 'Ansible Collections';
        case 4: return 'Review & Create';
        default: return 'Custom EE Wizard';
      }
    }
  };

  // Helper function to reset the custom EE form
  const resetCustomEEForm = () => {
    setCustomEEForm({
      name: '',
      description: '',
      base_image: '',
      custom_base_image: '',
      use_custom_base_image: false,
      python_packages: [],
      system_packages: [],
      ansible_collections: [],
      additional_build_steps: '',
      import_mode: '', // This ensures we go back to mode selection
      yaml_content: ''
    });
    setCustomEEStep(0); // Reset to first step
  };

  // Helper function to extract base image from YAML content
  const extractBaseImageFromYAML = (yamlContent: string): string => {
    try {
      const lines = yamlContent.split('\n');
      let inImagesSection = false;
      let inBaseImageSection = false;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Check if we're entering the images section
        if (trimmedLine === 'images:') {
          inImagesSection = true;
          continue;
        }
        
        // Check if we're entering the base_image section within images
        if (inImagesSection && trimmedLine === 'base_image:') {
          inBaseImageSection = true;
          continue;
        }
        
        // Look for the name field within base_image
        if (inBaseImageSection && trimmedLine.startsWith('name:')) {
          const imageNameMatch = trimmedLine.match(/name:\s*(.+)$/);
          if (imageNameMatch) {
            return imageNameMatch[1].trim();
          }
        }
        
        // Reset flags if we encounter a new top-level section
        if (trimmedLine.endsWith(':') && !trimmedLine.startsWith(' ') && !trimmedLine.startsWith('\t')) {
          if (trimmedLine !== 'images:') {
            inImagesSection = false;
          }
          inBaseImageSection = false;
        }
      }
    } catch (e) {
      console.error('Error parsing YAML:', e);
    }
    return '';
  };

  const canProceedToNextStep = (step: number): boolean => {
    if (customEEForm.import_mode === 'yaml') {
      switch (step) {
        case 0: 
          // YAML mode: name must be lowercase and not empty, YAML content required
          const nameValid = customEEForm.name.trim() !== '' && customEEForm.name === customEEForm.name.toLowerCase();
          const yamlValid = customEEForm.yaml_content.trim() !== '';
          return nameValid && yamlValid;
        case 1: 
          // Final step for YAML mode: check Red Hat registry authentication if needed
          const finalBaseImage = extractBaseImageFromYAML(customEEForm.yaml_content);
          const isRedHatRegistry = finalBaseImage?.includes('registry.redhat.io');
          if (isRedHatRegistry && rhAuthStatus !== 'authenticated') {
            return false;
          }
          return true;
        default: return false;
      }
    } else if (customEEForm.import_mode === 'wizard') {
      // Wizard mode logic
      switch (step) {
        case 0: 
          // Basic info: name must be lowercase and not empty, base image must be selected
          const nameValid = customEEForm.name.trim() !== '' && customEEForm.name === customEEForm.name.toLowerCase();
          const baseImageValid = customEEForm.use_custom_base_image ? 
            customEEForm.custom_base_image.trim() !== '' : 
            customEEForm.base_image !== '';
          return nameValid && baseImageValid;
        case 1: case 2: case 3: return true; // Optional steps
        case 4: 
          // Final step: check Red Hat registry authentication if needed
          const finalBaseImage = customEEForm.use_custom_base_image ? 
            customEEForm.custom_base_image : 
            customEEForm.base_image;
          
          // Check if using Red Hat registry
          const isRedHatRegistry = finalBaseImage?.includes('registry.redhat.io');
          if (isRedHatRegistry && rhAuthStatus !== 'authenticated') {
            return false; // Block if RH registry but not authenticated
          }
          return true;
        default: return false;
      }
    } else {
      // No mode selected yet - can't proceed until mode is selected
      return false;
    }
  };

  // Generate YAML preview based on current form state
  const generateYAMLPreview = () => {
    const finalBaseImage = customEEForm.use_custom_base_image ? 
      customEEForm.custom_base_image : 
      customEEForm.base_image || 'registry.redhat.io/ansible-automation-platform-25/ee-minimal-rhel9:latest';
      
    const yaml: any = {
      version: 3,
      images: {
        base_image: {
          name: finalBaseImage
        }
      },
      dependencies: {
        python_interpreter: {
          package_system: "python3"
        },
        ansible_core: {
          package_pip: "ansible-core"
        },
        ansible_runner: {
          package_pip: "ansible-runner"
        }
      }
    };

    // Add system packages (always include openssh-clients, sshpass as basics)
    const systemPackages = ['openssh-clients', 'sshpass', ...customEEForm.system_packages];
    if (systemPackages.length > 0) {
      yaml.dependencies.system = Array.from(new Set(systemPackages)); // Remove duplicates
    }

    // Add Python packages
    if (customEEForm.python_packages.length > 0) {
      yaml.dependencies.python = 'requirements.txt';
    }

    // Add Ansible collections
    if (customEEForm.ansible_collections.length > 0) {
      yaml.dependencies.galaxy = 'requirements.yml';
    }

    if (customEEForm.additional_build_steps.trim()) {
      yaml.additional_build_steps = customEEForm.additional_build_steps.trim();
    }

    return yaml;
  };

  const generateRequirementsTxt = () => {
    return customEEForm.python_packages.join('\n');
  };

  const generateRequirementsYml = () => {
    if (customEEForm.ansible_collections.length === 0) return '';
    
    const collections = customEEForm.ansible_collections.map(col => {
      if (col.includes(':')) {
        const [name, version] = col.split(':');
        return { name: name.trim(), version: version.trim() };
      }
      return { name: col.trim() };
    });

    return {
      collections: collections
    };
  };

  const generateBindepTxt = () => {
    return customEEForm.system_packages.join('\n');
  };

  // Red Hat Authentication Functions
  const checkRHAuthStatus = async () => {
    try {
      const response = await apiCall('/api/auth/redhat-status');
      if (response.authenticated) {
        setRHAuthStatus('authenticated');
        setRHUsername(response.username);
      } else {
        setRHAuthStatus('none');
        setRHUsername('');
      }
    } catch (err) {
      console.error('Failed to check RH auth status:', err);
      setRHAuthStatus('none');
    }
  };

  const authenticateWithRH = async () => {
    if (!rhCredentials.username || !rhCredentials.password) {
      setBuildResult({ type: 'danger', message: 'Please enter both username and password' });
      return;
    }

    setIsLoggingIn(true);
    try {
      const response = await apiCall('/api/auth/redhat-login', {
        method: 'POST',
        body: JSON.stringify({
          username: rhCredentials.username,
          password: rhCredentials.password
        })
      });

      if (response.success) {
        setRHAuthStatus('authenticated');
        setRHUsername(rhCredentials.username);
        setBuildResult({ type: 'success', message: '✅ Successfully authenticated with Red Hat registry!' });
        setIsRHAuthModalOpen(false);
        // Clear credentials for security
        setRHCredentials({ username: '', password: '' });
      } else {
        setRHAuthStatus('failed');
        setBuildResult({ type: 'danger', message: `❌ Authentication failed: ${response.message}` });
      }
    } catch (err: any) {
      setRHAuthStatus('failed');
      setBuildResult({ type: 'danger', message: `❌ Authentication error: ${err.message}` });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logoutFromRH = async () => {
    try {
      await apiCall('/api/auth/redhat-logout', {
        method: 'POST'
      });
      setRHAuthStatus('none');
      setRHUsername('');
      setBuildResult({ type: 'info', message: 'Logged out from Red Hat registry' });
    } catch (err: any) {
      setBuildResult({ type: 'warning', message: `Logout failed: ${err.message}` });
    }
  };

  const loadEnvironments = async () => {
    try {
      setConnectionStatus('checking');
      const data = await apiCall('/api/environments');
      
      const environments = data.environments || [];
      
      const formattedEnvironments = environments.map((env: any) => ({
        name: env.name,
        description: env.path || 'Execution Environment',
        type: 'ee',
        os_version: env.name.includes('rhel-8') ? 'rhel-8' : env.name.includes('rhel-9') ? 'rhel-9' : 'unknown',
        variant: env.name.includes('minimal') ? 'minimal' : env.name.includes('supported') ? 'supported' : 'custom',
        base_image: 'registry.redhat.io/ansible-automation-platform-25/ee-minimal-rhel9:latest',
        status: env.has_execution_environment ? 'available' : 'yaml_error',
        python_deps: [],
        ansible_collections: [],
        system_deps: [],
        build_args: {},
        template_type: '4-file'
      }));
      
      setEnvironments(formattedEnvironments);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch environments:', err);
      setBuildResult({ 
        type: 'danger', 
        message: `Failed to load environments: ${err.message}. Make sure the backend is running on localhost:8000.` 
      });
      setLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const data = await apiCall('/api/dashboard/stats');
      setDashboardStats(data);
    } catch (err: any) {
      console.error('Failed to fetch dashboard stats:', err);
      // Don't show error for dashboard stats as it's not critical
    }
  };

  const loadEnvironmentDetails = async (envName: string) => {
    const env = environments.find(e => e.name === envName);
    if (env) {
      const mockDetails = {
        environment: env,
        execution_environment_yml: {
          version: 1,
          build_arg_defaults: {
            ANSIBLE_GALAXY_CLI_COLLECTION_OPTS: "--ignore-certs"
          },
          ansible_galaxy: {
            requirements: "requirements.yml"
          },
          python: {
            requirements: "requirements.txt"
          },
          system: {
            bindep: "bindep.txt"
          }
        },
        requirements_txt: ['requests', 'pyyaml'],
        requirements_yml: {
          collections: [
            { name: 'community.general' },
            { name: 'ansible.posix' }
          ]
        },
        bindep_txt: ['git'],
        files_info: {}
      };
      
      setSelectedEnvDetails(mockDetails);
      setIsDetailsModalOpen(true);
    } else {
      setBuildResult({ type: 'danger', message: `Environment ${envName} not found` });
    }
  };

  const reloadEnvironments = async () => {
    setLoading(true);
    await loadEnvironments();
    await loadDashboardStats();
    await checkRHAuthStatus();
    setBuildResult({ type: 'success', message: 'Environments reloaded!' });
  };

  const startBuild = async () => {
    if (selectedEnvs.length === 0) {
      setBuildResult({ type: 'danger', message: 'Please select at least one environment' });
      return;
    }

    // Check if we need RH authentication
    const needsRHAuth = selectedEnvs.some(env => 
      env.includes('rhel') || env.includes('devtools') || env.includes('supported')
    );

    if (needsRHAuth && rhAuthStatus !== 'authenticated') {
      setBuildResult({ 
        type: 'warning', 
        message: 'Selected environments require Red Hat registry authentication. Please login first.' 
      });
      setIsRHAuthModalOpen(true);
      return;
    }

    setBuilding(true);
    setBuildResult(null);
    setIsBuildModalOpen(true);
    setBuildDebugInfo('Starting build...');
    setCurrentBuild({
      id: 'initializing',
      status: 'starting',
      environments: selectedEnvs,
      started_at: new Date().toISOString(),
      logs: ['🚀 Initializing build...', `📦 Environments: ${selectedEnvs.join(', ')}`],
      images: [],
      errors: []
    });

    try {
      setBuildDebugInfo('Sending request to backend...');
      const result = await apiCall('/api/builds/start', {
        method: 'POST',
        body: JSON.stringify({
          environments: selectedEnvs,
          container_runtime: 'podman'
        })
      });

      setBuildDebugInfo(`Response received: ${JSON.stringify(result, null, 2)}`);
      
      setBuildResult({ type: 'success', message: `Build started: ${result.build_id}` });
      setCurrentBuild(prev => prev ? { 
        ...prev, 
        id: result.build_id, 
        status: 'running',
        logs: [...prev.logs, `✅ Build started with ID: ${result.build_id}`, '🔄 Waiting for ansible-playbook output...']
      } : null);
      pollBuildStatus(result.build_id);
      
    } catch (err: any) {
      setBuildDebugInfo(`Error: ${err.message}`);
      setBuildResult({ type: 'danger', message: `Failed to start build: ${err.message}` });
      setBuilding(false);
      setIsBuildModalOpen(false);
    }
  };

  const pollBuildStatus = async (buildId: string) => {
    let pollAttempts = 0;
    const maxPollAttempts = 3;
    
    const poll = async () => {
      try {
        setBuildDebugInfo(prev => prev + `\nPolling status for build: ${buildId} (attempt ${pollAttempts + 1})`);
        
        const buildStatus = await apiCall(`/api/builds/${buildId}/status`);
        
        setBuildDebugInfo(prev => prev + `\nStatus: ${buildStatus.status}, Logs: ${buildStatus.logs?.length || 0} lines`);
        
        // Reset poll attempts on successful response
        pollAttempts = 0;
        
        const build = {
          id: buildStatus.build_id,
          status: buildStatus.status,
          environments: buildStatus.environments,
          started_at: buildStatus.start_time,
          completed_at: buildStatus.end_time,
          logs: buildStatus.logs || ['No logs available yet...'],
          images: buildStatus.successful_builds?.map((env: string) => `${env}:latest`) || [],
          errors: buildStatus.failed_builds || [],
          build_time_seconds: buildStatus.end_time ? 
            Math.round((new Date(buildStatus.end_time).getTime() - new Date(buildStatus.start_time).getTime()) / 1000) : 
            undefined
        };
        
        setCurrentBuild(build);

        if (build.status === 'running') {
          setTimeout(poll, 2000);
        } else {
          setBuilding(false);
          if (build.status === 'completed') {
            setBuildResult({ 
              type: 'success', 
              message: `✅ Build completed! Built ${build.images.length} images in ${build.build_time_seconds}s.` 
            });
          } else if (build.status === 'lost') {
            setBuildResult({ 
              type: 'warning', 
              message: `⚠️ Build was lost due to server restart. The build process may have continued, but connection was lost.` 
            });
          } else {
            setBuildResult({ 
              type: 'danger', 
              message: `❌ Build failed. Check logs for details.` 
            });
          }
          loadEnvironments();
          loadDashboardStats();
        }
      } catch (err: any) {
        pollAttempts++;
        setBuildDebugInfo(prev => prev + `\nPolling error (attempt ${pollAttempts}): ${err.message}`);
        
        if (err.message.includes('404')) {
          // Build not found - likely server restarted
          setBuildResult({ 
            type: 'warning', 
            message: `⚠️ Build status lost - server may have restarted. Build process may have continued.` 
          });
          setBuilding(false);
          return;
        }
        
        if (pollAttempts >= maxPollAttempts) {
          setBuildResult({ 
            type: 'danger', 
            message: `❌ Lost connection to build after ${maxPollAttempts} attempts. Build may still be running.` 
          });
          setBuilding(false);
          return;
        }
        
        // Retry with exponential backoff
        setTimeout(poll, Math.pow(2, pollAttempts) * 1000);
      }
    };
    
    poll();
  };

  const cancelBuild = async () => {
    if (!currentBuild?.id || currentBuild.id === 'initializing') return;

    try {
      await apiCall(`/api/builds/${currentBuild.id}`, {
        method: 'DELETE'
      });

      setBuilding(false);
      setCurrentBuild(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setBuildResult({ type: 'warning', message: 'Build cancelled' });
    } catch (error: any) {
      console.error('Error cancelling build:', error);
      setBuildResult({ type: 'warning', message: `Failed to cancel build: ${error.message}` });
    }
  };

  // Connection retry logic
  const retryConnection = async () => {
    setRetryCount(prev => prev + 1);
    setBuildResult({ type: 'info', message: `Attempting to reconnect... (attempt ${retryCount + 1})` });
    
    try {
      await loadEnvironments();
      await loadDashboardStats();
      await checkRHAuthStatus();
      setBuildResult({ type: 'success', message: 'Connection restored!' });
    } catch (err) {
      setBuildResult({ type: 'danger', message: 'Still unable to connect. Check if backend is running.' });
    }
  };

  // Dashboard card click handlers
  const showBuildIssues = () => {
    if (dashboardStats?.build_issues.details.length) {
      const issueText = dashboardStats.build_issues.details
        .map(issue => `${issue.environment}: ${issue.issue}`)
        .join('\n');
      
      setBuildResult({ 
        type: 'warning', 
        message: `Build Issues Found:\n${issueText}` 
      });
    }
  };

  const showLargeImages = () => {
    if (dashboardStats?.large_images.details.length) {
      const imageText = dashboardStats.large_images.details
        .map(img => `${img.environment}: ~${img.estimated_size_mb}MB`)
        .join('\n');
      
      setBuildResult({ 
        type: 'info', 
        message: `Large Images:\n${imageText}` 
      });
    }
  };

  const showRecentUpdates = () => {
    if (dashboardStats?.recently_updated.details.length) {
      const updateText = dashboardStats.recently_updated.details
        .map(env => `${env.environment}: ${env.days_ago} days ago`)
        .join('\n');
      
      setBuildResult({ 
        type: 'info', 
        message: `Recently Updated:\n${updateText}` 
      });
    }
  };

  // Update your useEffect to load custom EE data:
  React.useEffect(() => {
    loadEnvironments();
    loadDashboardStats();
    checkRHAuthStatus();
    loadCustomEEData(); // Add this line
  }, []);

  // Refresh dashboard stats every 30 seconds, but only if connected
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (connectionStatus === 'connected') {
        loadDashboardStats();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  const handleEnvToggle = (envName: string, checked: boolean) => {
    if (checked) {
      setSelectedEnvs([...selectedEnvs, envName]);
    } else {
      setSelectedEnvs(selectedEnvs.filter(name => name !== envName));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircleIcon style={{ color: '#3e8635' }} />;
      case 'yaml_error': return <ExclamationTriangleIcon style={{ color: '#f0ab00' }} />;
      case 'yaml_warning': return <InfoCircleIcon style={{ color: '#f0ab00' }} />;
      default: return <InfoCircleIcon style={{ color: '#2b9af3' }} />;
    }
  };

  const getBuildStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon style={{ color: '#3e8635' }} />;
      case 'failed': return <TimesCircleIcon style={{ color: '#c9190b' }} />;
      case 'lost': return <ExclamationCircleIcon style={{ color: '#f0ab00' }} />;
      case 'running': case 'starting': return <Spinner size="sm" />;
      default: return <ClockIcon style={{ color: '#6a6e73' }} />;
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircleIcon style={{ color: '#3e8635' }} />;
      case 'disconnected': return <DisconnectedIcon style={{ color: '#c9190b' }} />;
      case 'checking': return <Spinner size="sm" />;
    }
  };

  const getRHAuthStatusIcon = () => {
    switch (rhAuthStatus) {
      case 'authenticated': return <CheckCircleIcon style={{ color: '#3e8635' }} />;
      case 'failed': return <TimesCircleIcon style={{ color: '#c9190b' }} />;
      case 'none': return <KeyIcon style={{ color: '#f0ab00' }} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ee': return 'blue';
      case 'de': return 'purple';
      case 'devtools': return 'orange';
      case 'template': return 'cyan';
      default: return 'grey';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'template': return <PficonTemplateIcon />;
      case 'devtools': return <CodeIcon />;
      default: return <CubesIcon />;
    }
  };

  const getProgressValue = () => {
    if (!currentBuild) return 0;
    switch (currentBuild.status) {
      case 'starting': return 10;
      case 'running': return 50;
      case 'completed': return 100;
      case 'failed': case 'lost': return 100;
      default: return 0;
    }
  };

  const filteredEnvironments = environments.filter(env => {
    if (filterType !== 'all' && env.type !== filterType) return false;
    if (filterOS !== 'all' && !env.os_version.includes(filterOS)) return false;
    if (filterTemplateType !== 'all' && env.template_type !== filterTemplateType) return false;
    return true;
  });

  return (
    <Page>
      {/* Header Section */}
      <PageSection variant="light">
        <Split hasGutter>
          <SplitItem>
            <Flex alignItems={{ default: 'alignItemsCenter' }}>
              <FlexItem>
                <BuilderImageIcon style={{ color: '#0066cc', fontSize: '2rem' }} />
              </FlexItem>
              <FlexItem>
                <Title headingLevel="h1" size="2xl">
                  EE Builder
                </Title>
              </FlexItem>
            </Flex>
          </SplitItem>
          <SplitItem isFilled />
          <SplitItem>
            <Flex alignItems={{ default: 'alignItemsCenter' }}>
              {/* Connection Status Indicator */}
              <FlexItem>
                <div style={{ marginRight: '16px', display: 'flex', alignItems: 'center' }}>
                  {getConnectionStatusIcon()}
                  <Text style={{ marginLeft: '8px', fontSize: '14px' }}>
                    {connectionStatus === 'connected' && 'Connected'}
                    {connectionStatus === 'disconnected' && 'Disconnected'}
                    {connectionStatus === 'checking' && 'Connecting...'}
                  </Text>
                  {connectionStatus === 'disconnected' && (
                    <Button 
                      variant="link" 
                      isInline 
                      onClick={retryConnection}
                      style={{ marginLeft: '8px', padding: '0' }}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </FlexItem>
              <FlexItem>
                <Button
                  variant="secondary"
                  icon={<PlusCircleIcon />}
                  onClick={() => {
                    resetCustomEEForm(); // Reset form when opening
                    setIsCustomEEWizardOpen(true);
                  }}
                  style={{ marginRight: '8px' }}
                  isDisabled={connectionStatus !== 'connected'}
                >
                  Create Custom EE
                </Button>
              </FlexItem>
              <FlexItem>
                <Button
                  variant="secondary"
                  icon={<SyncIcon />}
                  onClick={reloadEnvironments}
                  isLoading={loading}
                  isDisabled={connectionStatus !== 'connected'}
                >
                  Reload Environments
                </Button>
              </FlexItem>
            </Flex>
          </SplitItem>
        </Split>
        <Text component="p" style={{ marginTop: '8px' }}>
          Build and manage Ansible Execution Environments with ease
        </Text>
        
        {/* Enhanced Environment Health Dashboard */}
        {dashboardStats && !dashboardStats.error && (
          <Grid hasGutter style={{ marginTop: '16px' }}>
            <GridItem lg={2} md={4} sm={6}>
              <Card isCompact isClickable>
                <CardBody>
                  <Split>
                    <SplitItem>
                      <Text component="small">Ready to Build</Text>
                      <Title headingLevel="h3" size="xl" style={{ color: '#3e8635' }}>
                        {dashboardStats.ready_to_build}
                      </Title>
                      <Text component="small" style={{ color: '#6a6e73' }}>
                        environments
                      </Text>
                    </SplitItem>
                    <SplitItem isFilled />
                    <SplitItem>
                      <CheckCircleIcon style={{ fontSize: '1.5rem', color: '#3e8635' }} />
                    </SplitItem>
                  </Split>
                </CardBody>
              </Card>
            </GridItem>

            <GridItem lg={2} md={4} sm={6}>
              <Card isCompact isClickable onClick={showBuildIssues}>
                <CardBody>
                  <Split>
                    <SplitItem>
                      <Text component="small">Build Issues</Text>
                      <Title 
                        headingLevel="h3" 
                        size="xl" 
                        style={{ color: dashboardStats.build_issues.count > 0 ? '#f0ab00' : '#3e8635' }}
                      >
                        {dashboardStats.build_issues.count}
                      </Title>
                      <Text component="small" style={{ color: '#6a6e73' }}>
                        {dashboardStats.build_issues.count === 1 ? 'issue' : 'issues'}
                      </Text>
                    </SplitItem>
                    <SplitItem isFilled />
                    <SplitItem>
                      {dashboardStats.build_issues.count > 0 ? (
                        <ExclamationTriangleIcon style={{ fontSize: '1.5rem', color: '#f0ab00' }} />
                      ) : (
                        <CheckCircleIcon style={{ fontSize: '1.5rem', color: '#3e8635' }} />
                      )}
                    </SplitItem>
                  </Split>
                </CardBody>
              </Card>
            </GridItem>

            <GridItem lg={2} md={4} sm={6}>
              <Card isCompact isClickable onClick={showLargeImages}>
                <CardBody>
                  <Split>
                    <SplitItem>
                      <Text component="small">Large Images</Text>
                      <Title 
                        headingLevel="h3" 
                        size="xl" 
                        style={{ color: dashboardStats.large_images.count > 0 ? '#f0ab00' : '#6a6e73' }}
                      >
                        {dashboardStats.large_images.count}
                      </Title>
                      <Text component="small" style={{ color: '#6a6e73' }}>
                        over 500MB
                      </Text>
                    </SplitItem>
                    <SplitItem isFilled />
                    <SplitItem>
                      <CubesIcon style={{ fontSize: '1.5rem', color: dashboardStats.large_images.count > 0 ? '#f0ab00' : '#6a6e73' }} />
                    </SplitItem>
                  </Split>
                </CardBody>
              </Card>
            </GridItem>

            <GridItem lg={2} md={4} sm={6}>
              <Card isCompact isClickable onClick={showRecentUpdates}>
                <CardBody>
                  <Split>
                    <SplitItem>
                      <Text component="small">Recently Updated</Text>
                      <Title headingLevel="h3" size="xl" style={{ color: '#0066cc' }}>
                        {dashboardStats.recently_updated.count}
                      </Title>
                      <Text component="small" style={{ color: '#6a6e73' }}>
                        last 7 days
                      </Text>
                    </SplitItem>
                    <SplitItem isFilled />
                    <SplitItem>
                      <ClockIcon style={{ fontSize: '1.5rem', color: '#0066cc' }} />
                    </SplitItem>
                  </Split>
                </CardBody>
              </Card>
            </GridItem>

            <GridItem lg={2} md={4} sm={6}>
              <Card isCompact isClickable>
                <CardBody>
                  <Split>
                    <SplitItem>
                      <Text component="small">Currently Building</Text>
                      <Title 
                        headingLevel="h3" 
                        size="xl" 
                        style={{ color: dashboardStats.currently_building.count > 0 ? '#2b9af3' : '#6a6e73' }}
                      >
                        {dashboardStats.currently_building.count}
                      </Title>
                      <Text component="small" style={{ color: '#6a6e73' }}>
                        {dashboardStats.currently_building.count === 1 ? 'build' : 'builds'}
                      </Text>
                    </SplitItem>
                    <SplitItem isFilled />
                    <SplitItem>
                      {dashboardStats.currently_building.count > 0 ? (
                        <Spinner size="md" />
                      ) : (
                        <PlayIcon style={{ fontSize: '1.5rem', color: '#6a6e73' }} />
                      )}
                    </SplitItem>
                  </Split>
                </CardBody>
              </Card>
            </GridItem>

            <GridItem lg={2} md={4} sm={6}>
              <Card isCompact isClickable>
                <CardBody>
                  <Split>
                    <SplitItem>
                      <Text component="small">Success Rate</Text>
                      <Title 
                        headingLevel="h3" 
                        size="xl" 
                        style={{ 
                          color: dashboardStats.success_rate.percentage >= 90 ? '#3e8635' : 
                                 dashboardStats.success_rate.percentage >= 70 ? '#f0ab00' : '#c9190b' 
                        }}
                      >
                        {dashboardStats.success_rate.percentage}%
                      </Title>
                      <Text component="small" style={{ color: '#6a6e73' }}>
                        last 30 days
                      </Text>
                    </SplitItem>
                    <SplitItem isFilled />
                    <SplitItem>
                      {dashboardStats.success_rate.percentage >= 90 ? (
                        <CheckCircleIcon style={{ fontSize: '1.5rem', color: '#3e8635' }} />
                      ) : dashboardStats.success_rate.percentage >= 70 ? (
                        <ExclamationTriangleIcon style={{ fontSize: '1.5rem', color: '#f0ab00' }} />
                      ) : (
                        <TimesCircleIcon style={{ fontSize: '1.5rem', color: '#c9190b' }} />
                      )}
                    </SplitItem>
                  </Split>
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        )}
      </PageSection>

      {/* Alert Messages */}
      {buildResult && (
        <PageSection>
          <Alert variant={buildResult.type} title={buildResult.message} actionClose={<AlertActionCloseButton aria-label="Close alert" onClose={() => setBuildResult(null)} />} />
        </PageSection>
      )}

      {/* Connection Warning */}
      {connectionStatus === 'disconnected' && (
        <PageSection>
          <Alert 
            variant="danger" 
            title="Backend Connection Lost" 
            actionClose={<AlertActionCloseButton aria-label="Close alert" onClose={() => setConnectionStatus('checking')} />}
          >
            Unable to connect to the backend server. Make sure it's running on localhost:8000.
          </Alert>
        </PageSection>
      )}

      {/* Main Content */}
      <PageSection>
        <Grid hasGutter>
          <GridItem lg={8} md={12}>
            <Card>
              <CardTitle>
                <Split>
                  <SplitItem>
                    <Flex alignItems={{ default: 'alignItemsCenter' }}>
                      <FlexItem>
                        <CubesIcon />
                      </FlexItem>
                      <FlexItem>
                        Available Environments ({filteredEnvironments.length})
                      </FlexItem>
                    </Flex>
                  </SplitItem>
                  <SplitItem isFilled />
                  <SplitItem>
                    <Flex>
                      <FlexItem>
                        <select 
                          value={filterType} 
                          onChange={(e) => setFilterType(e.target.value)}
                          style={{ marginRight: '8px', padding: '4px' }}
                        >
                          <option value="all">All Types</option>
                          <option value="ee">EE Only</option>
                          <option value="de">DE Only</option>
                          <option value="devtools">DevTools Only</option>
                          <option value="template">Templates Only</option>
                        </select>
                      </FlexItem>
                      <FlexItem>
                        <select 
                          value={filterOS} 
                          onChange={(e) => setFilterOS(e.target.value)}
                          style={{ marginRight: '8px', padding: '4px' }}
                        >
                          <option value="all">All OS</option>
                          <option value="8">RHEL 8</option>
                          <option value="9">RHEL 9</option>
                        </select>
                      </FlexItem>
                      <FlexItem>
                        <select 
                          value={filterTemplateType} 
                          onChange={(e) => setFilterTemplateType(e.target.value)}
                          style={{ padding: '4px' }}
                        >
                          <option value="all">All Templates</option>
                          <option value="1-file">1-File</option>
                          <option value="4-file">4-File</option>
                        </select>
                      </FlexItem>
                    </Flex>
                  </SplitItem>
                </Split>
              </CardTitle>
              <CardBody>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Spinner size="lg" />
                    <Text style={{ marginTop: '16px' }}>Loading environments...</Text>
                  </div>
                ) : connectionStatus === 'disconnected' ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <DisconnectedIcon style={{ fontSize: '3rem', color: '#c9190b', marginBottom: '16px' }} />
                    <Text style={{ marginBottom: '16px' }}>Cannot load environments - backend disconnected</Text>
                    <Button variant="primary" onClick={retryConnection}>
                      Retry Connection
                    </Button>
                  </div>
                ) : (
                  <div>
                    {filteredEnvironments.map((env) => (
                      <div key={env.name} style={{ marginBottom: '16px', padding: '16px', border: '1px solid #d2d2d2', borderRadius: '8px' }}>
                        <Grid hasGutter>
                          <GridItem span={1}>
                            <Checkbox
                              id={env.name}
                              name={env.name}
                              isChecked={selectedEnvs.includes(env.name)}
                              onChange={(event, checked) => handleEnvToggle(env.name, checked)}
                              isDisabled={connectionStatus !== 'connected'}
                            />
                          </GridItem>
                          <GridItem span={11}>
                            <Split>
                              <SplitItem>
                                <div>
                                  <Flex alignItems={{ default: 'alignItemsCenter' }} style={{ marginBottom: '8px' }}>
                                    <FlexItem>
                                      {getStatusIcon(env.status)}
                                    </FlexItem>
                                    <FlexItem>
                                      {getTypeIcon(env.type)}
                                    </FlexItem>
                                    <FlexItem>
                                      <Title headingLevel="h4" size="md">
                                        {env.name}
                                      </Title>
                                    </FlexItem>
                                  </Flex>
                                  <Text component="small" style={{ display: 'block', marginBottom: '8px' }}>
                                    {env.description}
                                  </Text>
                                  <div style={{ marginBottom: '8px' }}>
                                    <Label color={getTypeColor(env.type)}>{env.type.toUpperCase()}</Label>
                                    <Label color="purple" style={{ marginLeft: '8px' }}>
                                      {env.os_version.toUpperCase()}
                                    </Label>
                                    <Label color="cyan" style={{ marginLeft: '8px' }}>
                                      {env.variant.toUpperCase()}
                                    </Label>
                                    <Label color="grey" style={{ marginLeft: '8px' }}>
                                      {env.template_type}
                                    </Label>
                                  </div>
                                  <Text component="small" style={{ fontFamily: 'monospace', fontSize: '11px', color: '#666' }}>
                                    {env.base_image}
                                  </Text>
                                </div>
                              </SplitItem>
                              <SplitItem isFilled />
                              <SplitItem>
                                <Button
                                  variant="link"
                                  icon={<InfoCircleIcon />}
                                  onClick={() => loadEnvironmentDetails(env.name)}
                                  isDisabled={connectionStatus !== 'connected'}
                                >
                                  Details
                                </Button>
                              </SplitItem>
                            </Split>
                          </GridItem>
                        </Grid>
                      </div>
                    ))}
                    
                    {filteredEnvironments.length === 0 && (
                      <Text>No environments found matching the current filters.</Text>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          </GridItem>

          <GridItem lg={4} md={12}>
            <Card>
              <CardTitle>Build Control</CardTitle>
              <CardBody>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 'bold' }}>Selected Environments: {selectedEnvs.length}</div>
                  {selectedEnvs.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      {selectedEnvs.map(env => (
                        <Label key={env} color="blue" style={{ marginRight: '4px', marginBottom: '4px' }}>
                          {env}
                        </Label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Red Hat Authentication Status */}
                <div style={{ marginBottom: '16px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                  <Text component="small" style={{ fontWeight: 'bold' }}>Red Hat Registry:</Text>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                    {rhAuthStatus === 'authenticated' ? (
                      <>
                        <CheckCircleIcon style={{ color: '#3e8635', marginRight: '8px' }} />
                        <Text component="small">Authenticated as {rhUsername} ✅</Text>
                        <Button 
                          variant="link" 
                          isInline 
                          onClick={logoutFromRH}
                          style={{ marginLeft: '8px', padding: '0', fontSize: '12px' }}
                          isDisabled={connectionStatus !== 'connected'}
                        >
                          Logout
                        </Button>
                      </>
                    ) : (
                      <>
                        <KeyIcon style={{ color: '#f0ab00', marginRight: '8px' }} />
                        <Text component="small">Not authenticated</Text>
                        <Button 
                          variant="link" 
                          isInline 
                          onClick={() => setIsRHAuthModalOpen(true)}
                          style={{ marginLeft: '8px', padding: '0' }}
                          isDisabled={connectionStatus !== 'connected'}
                        >
                          Login
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  variant="primary"
                  icon={<PlayIcon />}
                  onClick={startBuild}
                  isDisabled={selectedEnvs.length === 0 || building || connectionStatus !== 'connected'}
                  isLoading={building}
                  style={{ marginBottom: '16px', width: '100%' }}
                >
                  {building ? 'Building...' : 'Start Build'}
                </Button>

                <Divider style={{ margin: '16px 0' }} />

                <div style={{ padding: '12px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
                  <Text component="small">
                    <strong>Connection:</strong> {getConnectionStatusIcon()} {connectionStatus}<br />
                    <strong>Backend:</strong> localhost:8000<br />
                    <strong>Environments:</strong> {environments.length} found<br />
                    <strong>Build System:</strong> ansible-builder<br />
                    <strong>RH Registry:</strong> {rhAuthStatus === 'authenticated' ? `✅ ${rhUsername}` : '❌ Not authenticated'}
                  </Text>
                </div>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </PageSection>

      {/* Build Progress Modal */}
      <Modal
        variant={ModalVariant.large}
        title={
          <Flex alignItems={{ default: 'alignItemsCenter' }}>
            <FlexItem>{currentBuild && getBuildStatusIcon(currentBuild.status)}</FlexItem>
            <FlexItem>
              Build Progress {currentBuild && currentBuild.id !== 'initializing' && `(${currentBuild.id})`}
            </FlexItem>
          </Flex>
        }
        isOpen={isBuildModalOpen}
        onClose={() => setIsBuildModalOpen(false)}
        actions={[
          ...(building && currentBuild?.status === 'running' ? [
            <Button key="cancel" variant="secondary" onClick={cancelBuild} icon={<StopIcon />}>
              Cancel Build
            </Button>
          ] : []),
          <Button key="close" variant="primary" onClick={() => setIsBuildModalOpen(false)}>
            Close
          </Button>
        ]}
      >
        <div style={{ minHeight: '400px' }}>
          {/* Build Info */}
          <Card style={{ marginBottom: '1rem' }}>
            <CardBody>
              <Grid hasGutter>
                <GridItem span={6}>
                  <Text><strong>Environments:</strong> {selectedEnvs.join(', ')}</Text>
                  <Text><strong>Container Runtime:</strong> podman</Text>
                </GridItem>
                <GridItem span={6}>
                  {currentBuild && (
                    <>
                      <Text><strong>Status:</strong> {currentBuild.status}</Text>
                      <Text><strong>Started:</strong> {new Date(currentBuild.started_at).toLocaleTimeString()}</Text>
                      {currentBuild.build_time_seconds && (
                        <Text><strong>Duration:</strong> {currentBuild.build_time_seconds}s</Text>
                      )}
                    </>
                  )}
                </GridItem>
              </Grid>
            </CardBody>
          </Card>

          {/* Progress Bar */}
          <Progress
            value={getProgressValue()}
            title="Build Progress"
            size={ProgressSize.lg}
            style={{ marginBottom: '1rem' }}
          />

          {/* Status Alert */}
          {currentBuild && (
            <Alert
              variant={currentBuild.status === 'completed' ? 'success' : 
                      currentBuild.status === 'failed' ? 'danger' : 
                      currentBuild.status === 'lost' ? 'warning' : 'info'}
              title={`Build ${currentBuild.status}`}
              isInline
              style={{ marginBottom: '1rem' }}
            >
              {currentBuild.status === 'completed' && 
                `Successfully built ${currentBuild.images.length} environments`}
              {currentBuild.status === 'failed' && 
                'Build failed - check logs below for details'}
              {currentBuild.status === 'lost' && 
                'Build connection lost due to server restart - process may have continued'}
              {(currentBuild.status === 'running' || currentBuild.status === 'starting') && 
                'Build in progress - real-time logs below'}
            </Alert>
          )}

          {/* Build Logs */}
          {currentBuild?.logs && (
            <Card>
              <CardTitle>Real-time Build Logs</CardTitle>
              <CardBody>
                <div 
                  style={{ 
                    backgroundColor: '#1e1e1e', 
                    color: '#ffffff', 
                    padding: '1rem', 
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {currentBuild.logs.map((log, index) => (
                    <div key={index} style={{ marginBottom: '0.25rem' }}>
                      {log}
                    </div>
                  ))}
                  {building && (
                    <div style={{ marginTop: '0.5rem', opacity: 0.7 }}>
                      <Spinner size="sm" /> Waiting for more output...
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Debug Info */}
          {buildDebugInfo && (
            <ExpandableSection toggleText="Debug Info (for troubleshooting)" style={{ marginTop: '1rem' }}>
              <TextArea
                value={buildDebugInfo}
                rows={10}
                readOnly
                style={{ fontFamily: 'monospace', fontSize: '11px' }}
              />
            </ExpandableSection>
          )}
        </div>
      </Modal>

      {/* Red Hat Authentication Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Red Hat Registry Authentication"
        isOpen={isRHAuthModalOpen}
        onClose={() => setIsRHAuthModalOpen(false)}
        actions={[
          <Button 
            key="login" 
            variant="primary" 
            onClick={authenticateWithRH}
            isLoading={isLoggingIn}
            isDisabled={!rhCredentials.username || !rhCredentials.password}
          >
            {isLoggingIn ? 'Authenticating...' : 'Login'}
          </Button>,
          <Button key="cancel" variant="secondary" onClick={() => setIsRHAuthModalOpen(false)}>
            Cancel
          </Button>
        ]}
      >
        <div style={{ padding: '16px' }}>
          <Alert 
            variant="info" 
            title="Red Hat Registry Login Required" 
            isInline 
            style={{ marginBottom: '16px' }}
          >
            Selected environments require images from registry.redhat.io. Please provide your Red Hat Customer Portal credentials.
          </Alert>
          
          <Form>
            <FormGroup label="Red Hat Username" isRequired fieldId="rh-username">
              <TextInput
                id="rh-username"
                type="text"
                value={rhCredentials.username}
                onChange={(event, value) => setRHCredentials(prev => ({ ...prev, username: value }))}
                placeholder="your-redhat-username"
                autoComplete="username"
              />
            </FormGroup>
            
            <FormGroup label="Red Hat Password" isRequired fieldId="rh-password">
              <TextInput
                id="rh-password"
                type="password"
                value={rhCredentials.password}
                onChange={(event, value) => setRHCredentials(prev => ({ ...prev, password: value }))}
                placeholder="your-redhat-password"
                autoComplete="current-password"
              />
            </FormGroup>
          </Form>
          
          <Text component="small" style={{ color: '#6a6e73', marginTop: '8px' }}>
            Your credentials are used only to authenticate with registry.redhat.io and are not stored.
          </Text>
        </div>
      </Modal>

      {/* Environment Details Modal */}
      <Modal
        variant={ModalVariant.large}
        title={selectedEnvDetails ? `Environment Details: ${selectedEnvDetails.environment.name}` : "Environment Details"}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
      >
        {selectedEnvDetails && (
          <Tabs activeKey={activeTab} onSelect={(event, tabIndex) => setActiveTab(tabIndex)}>
            <Tab eventKey={0} title={<TabTitleText>Overview</TabTitleText>}>
              <div style={{ padding: '16px' }}>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Name</DescriptionListTerm>
                    <DescriptionListDescription>{selectedEnvDetails.environment.name}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Description</DescriptionListTerm>
                    <DescriptionListDescription>{selectedEnvDetails.environment.description}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Type</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Label color={getTypeColor(selectedEnvDetails.environment.type)}>
                        {selectedEnvDetails.environment.type.toUpperCase()}
                      </Label>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Template Type</DescriptionListTerm>
                    <DescriptionListDescription>{selectedEnvDetails.environment.template_type}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Base Image</DescriptionListTerm>
                    <DescriptionListDescription style={{ fontFamily: 'monospace' }}>
                      {selectedEnvDetails.environment.base_image}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </div>
            </Tab>
            <Tab eventKey={1} title={<TabTitleText>Configuration Files</TabTitleText>}>
              <div style={{ padding: '16px' }}>
                <ExpandableSection toggleText="execution-environment.yml" isExpanded>
                  <TextArea
                    value={JSON.stringify(selectedEnvDetails.execution_environment_yml, null, 2)}
                    rows={10}
                    readOnly
                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  />
                </ExpandableSection>
              </div>
            </Tab>
          </Tabs>
        )}
      </Modal>

      {/* Custom EE Wizard Modal */}
      <Modal
        variant={customEEStep === (customEEForm.import_mode === 'yaml' ? 1 : 4) ? ModalVariant.large : ModalVariant.medium}
        title={`Create Custom EE - Step ${customEEStep + 1}/${customEEForm.import_mode === 'yaml' ? '2' : '5'}: ${getStepTitle(customEEStep)}`}
        isOpen={isCustomEEWizardOpen}
        onClose={() => {
          setIsCustomEEWizardOpen(false);
          resetCustomEEForm(); // Use the reset function
        }}
        actions={[
          ...(customEEStep < (customEEForm.import_mode === 'yaml' ? 1 : 4) ? [
            <Button 
              key="next" 
              variant="primary" 
              onClick={() => setCustomEEStep(prev => prev + 1)}
              isDisabled={!canProceedToNextStep(customEEStep)}
            >
              Next
            </Button>
          ] : [
            <Button 
              key="create" 
              variant="primary" 
              onClick={createCustomEE}
              isDisabled={!canProceedToNextStep(customEEStep)}
            >
              Create & Build Environment
            </Button>
          ]),
          ...(customEEStep > 0 ? [
            <Button key="back" variant="secondary" onClick={() => setCustomEEStep(prev => prev - 1)}>
              Back
            </Button>
          ] : []),
          <Button key="cancel" variant="link" onClick={() => {
            setIsCustomEEWizardOpen(false);
            resetCustomEEForm(); // Use the reset function
          }}>
            Cancel
          </Button>
        ]}
      >
        <div style={{ minHeight: '600px', maxHeight: '80vh', overflow: 'hidden' }}>
          <Grid hasGutter>
            {/* Main Content */}
            <GridItem span={customEEStep === (customEEForm.import_mode === 'yaml' ? 1 : 4) ? 12 : 7}>
              <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
                
                {/* Step 0: Mode Selection or Basic Information */}
                {customEEStep === 0 && (
                  <>
                    {/* Mode Selection - show when no mode selected */}
                    {!customEEForm.import_mode && (
                      <div style={{ marginBottom: '24px' }}>
                        <Alert variant="info" title="Choose Your Creation Method" isInline style={{ marginBottom: '20px' }}>
                          Create a custom Execution Environment using our guided wizard or import an existing YAML configuration.
                        </Alert>
                        
                        <Card>
                          <CardBody>
                            <div style={{ display: 'grid', gap: '16px' }}>
                              <div 
                                style={{ 
                                  padding: '16px', 
                                  border: '1px solid #d2d2d2',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  backgroundColor: 'white'
                                }}
                                onClick={() => setCustomEEForm(prev => ({ ...prev, import_mode: 'wizard' }))}
                              >
                                <Split>
                                  <SplitItem>
                                    <input 
                                      type="radio" 
                                      checked={false} 
                                      onChange={() => setCustomEEForm(prev => ({ ...prev, import_mode: 'wizard' }))}
                                      style={{ marginRight: '12px' }}
                                    />
                                    <strong>🧭 Guided Wizard</strong>
                                  </SplitItem>
                                </Split>
                                <Text style={{ marginTop: '8px', marginLeft: '24px' }}>
                                  Step-by-step configuration with templates and validation. Best for users new to Execution Environments.
                                </Text>
                              </div>
                              
                              <div 
                                style={{ 
                                  padding: '16px', 
                                  border: '1px solid #d2d2d2',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  backgroundColor: 'white'
                                }}
                                onClick={() => setCustomEEForm(prev => ({ ...prev, import_mode: 'yaml' }))}
                              >
                                <Split>
                                  <SplitItem>
                                    <input 
                                      type="radio" 
                                      checked={false} 
                                      onChange={() => setCustomEEForm(prev => ({ ...prev, import_mode: 'yaml' }))}
                                      style={{ marginRight: '12px' }}
                                    />
                                    <strong>📄 Import YAML</strong>
                                  </SplitItem>
                                </Split>
                                <Text style={{ marginTop: '8px', marginLeft: '24px' }}>
                                  Paste an existing execution-environment.yml file content. The YAML will be used exactly as provided with no modifications.
                                </Text>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      </div>
                    )}
                    
                    {/* YAML Import Mode Content */}
                    {customEEForm.import_mode === 'yaml' && (
                      <div>
                        <Alert variant="info" title="Import Execution Environment YAML" isInline style={{ marginBottom: '20px' }}>
                          Paste your execution-environment.yml content below. The YAML will be written exactly as provided - no processing or modification will be done.
                        </Alert>
                        
                        <Form>
                          <FormGroup label="Environment Name" isRequired fieldId="ee-name">
                            <TextInput
                              id="ee-name"
                              type="text"
                              value={customEEForm.name}
                              onChange={(event, value) => setCustomEEForm(prev => ({ ...prev, name: value }))}
                              placeholder="my-custom-ee"
                              validated={customEEForm.name && customEEForm.name !== customEEForm.name.toLowerCase() ? 'error' : 'default'}
                            />
                            <Text component="small" style={{ color: '#6a6e73' }}>
                              Use only lowercase letters, numbers, hyphens, and underscores. This will be the folder name in environments/
                            </Text>
                            {customEEForm.name && customEEForm.name !== customEEForm.name.toLowerCase() && (
                              <Text component="small" style={{ color: '#c9190b' }}>
                                ⚠️ Environment name must be lowercase (required by container registries)
                              </Text>
                            )}
                          </FormGroup>
                          
                          <FormGroup label="execution-environment.yml Content" isRequired fieldId="yaml-content">
                            <TextArea
                              id="yaml-content"
                              value={customEEForm.yaml_content}
                              onChange={(event, value) => setCustomEEForm(prev => ({ ...prev, yaml_content: value }))}
                              placeholder={`version: 3

images:
  base_image:
    name: registry.fedoraproject.org/fedora:42

dependencies:
  python_interpreter:
    package_system: python3
  ansible_core:
    package_pip: ansible-core
  ansible_runner:
    package_pip: ansible-runner
  system:
    - openssh-clients
    - sshpass
  galaxy:
    collections:
      - name: community.postgresql`}
                              rows={15}
                              style={{ fontFamily: 'monospace', fontSize: '12px' }}
                            />
                            <Text component="small" style={{ color: '#6a6e73' }}>
                              Paste your complete execution-environment.yml content here
                            </Text>
                            {/* Show extracted base image for debugging */}
                            {customEEForm.yaml_content && (
                              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
                                <Text component="small" style={{ fontWeight: 'bold' }}>
                                  Detected Base Image: 
                                </Text>
                                <Text component="small" style={{ fontFamily: 'monospace', marginLeft: '8px' }}>
                                  {extractBaseImageFromYAML(customEEForm.yaml_content) || 'None detected'}
                                </Text>
                              </div>
                            )}
                          </FormGroup>
                        </Form>
                      </div>
                    )}

                    {/* Wizard Mode Content - Basic Information */}
                    {customEEForm.import_mode === 'wizard' && (
                      <div>
                        <Alert variant="info" title="Create Your Custom Execution Environment" isInline style={{ marginBottom: '20px' }}>
                          This wizard will help you create a custom Execution Environment with your specific dependencies and tools.
                        </Alert>
                    
                        <Form>
                          <FormGroup label="Environment Name" isRequired fieldId="ee-name">
                            <TextInput
                              id="ee-name"
                              type="text"
                              value={customEEForm.name}
                              onChange={(event, value) => setCustomEEForm(prev => ({ ...prev, name: value }))}
                              placeholder="my-custom-ee"
                              validated={customEEForm.name && customEEForm.name !== customEEForm.name.toLowerCase() ? 'error' : 'default'}
                            />
                            <Text component="small" style={{ color: '#6a6e73' }}>
                              Use only lowercase letters, numbers, hyphens, and underscores
                            </Text>
                            {customEEForm.name && customEEForm.name !== customEEForm.name.toLowerCase() && (
                              <Text component="small" style={{ color: '#c9190b' }}>
                                ⚠️ Environment name must be lowercase (required by container registries)
                              </Text>
                            )}
                          </FormGroup>
                          
                          <FormGroup label="Description" fieldId="ee-description">
                            <TextArea
                              id="ee-description"
                              value={customEEForm.description}
                              onChange={(event, value) => setCustomEEForm(prev => ({ ...prev, description: value }))}
                              placeholder="Describe what this execution environment will be used for..."
                              rows={3}
                            />
                          </FormGroup>
                          
                          <FormGroup label="Base Image" isRequired fieldId="base-image">
                            {/* Option to use custom base image */}
                            <Checkbox
                              id="use-custom-base"
                              label="Use custom base image"
                              isChecked={customEEForm.use_custom_base_image}
                              onChange={(event, checked) => setCustomEEForm(prev => ({ 
                                ...prev, 
                                use_custom_base_image: checked,
                                base_image: checked ? '' : prev.base_image,
                                custom_base_image: checked ? prev.custom_base_image : ''
                              }))}
                              style={{ marginBottom: '12px' }}
                            />
                            
                            {customEEForm.use_custom_base_image ? (
                              <>
                                <TextInput
                                  id="custom-base-image"
                                  type="text"
                                  value={customEEForm.custom_base_image}
                                  onChange={(event, value) => setCustomEEForm(prev => ({ ...prev, custom_base_image: value }))}
                                  placeholder="registry.redhat.io/ansible-automation-platform-25/ee-minimal-rhel9:latest"
                                />
                                {customEEForm.custom_base_image?.includes('registry.redhat.io') && rhAuthStatus !== 'authenticated' && (
                                  <Alert variant="warning" title="Red Hat Registry Authentication Required" isInline style={{ marginTop: '8px' }}>
                                    This base image requires Red Hat registry authentication. 
                                    <Button 
                                      variant="link" 
                                      isInline 
                                      onClick={() => setIsRHAuthModalOpen(true)}
                                      style={{ marginLeft: '8px', padding: '0' }}
                                    >
                                      Login now
                                    </Button>
                                  </Alert>
                                )}
                              </>
                            ) : (
                              <div style={{ 
                                display: 'grid', 
                                gap: '12px', 
                                marginTop: '8px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                border: '1px solid #d2d2d2',
                                borderRadius: '4px',
                                padding: '12px'
                              }}>
                                {Object.keys(availableBaseImages).length > 0 ? (
                                  Object.entries(availableBaseImages).map(([key, image]) => (
                                    <Card 
                                      key={key} 
                                      isSelectable 
                                      isSelected={customEEForm.base_image === image.name}
                                      onClick={() => setCustomEEForm(prev => ({ ...prev, base_image: image.name }))}
                                      style={{ cursor: 'pointer', margin: '0' }}
                                      isCompact
                                    >
                                      <CardBody>
                                        <Split>
                                          <SplitItem>
                                            <Title headingLevel="h4" size="md">{key}</Title>
                                            <Text component="small" style={{ display: 'block', marginBottom: '4px' }}>
                                              {image.description}
                                            </Text>
                                            <div>
                                              <Label color="blue">{image.type}</Label>
                                              <Label color="purple" style={{ marginLeft: '8px' }}>{image.os}</Label>
                                            </div>
                                          </SplitItem>
                                          <SplitItem isFilled />
                                          {customEEForm.base_image === image.name && (
                                            <SplitItem>
                                              <CheckCircleIcon style={{ color: '#3e8635' }} />
                                            </SplitItem>
                                          )}
                                        </Split>
                                      </CardBody>
                                    </Card>
                                  ))
                                ) : (
                                  <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <Spinner size="md" />
                                    <Text style={{ marginTop: '8px' }}>Loading base images...</Text>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Show Red Hat auth warning for selected predefined images */}
                            {!customEEForm.use_custom_base_image && customEEForm.base_image?.includes('registry.redhat.io') && rhAuthStatus !== 'authenticated' && (
                              <Alert variant="warning" title="Red Hat Registry Authentication Required" isInline style={{ marginTop: '12px' }}>
                                The selected base image requires Red Hat registry authentication. 
                                <Button 
                                  variant="link" 
                                  isInline 
                                  onClick={() => setIsRHAuthModalOpen(true)}
                                  style={{ marginLeft: '8px', padding: '0' }}
                                >
                                  Login now
                                </Button>
                              </Alert>
                            )}
                          </FormGroup>
                        </Form>
                      </div>
                    )}
                  </>
                )}

                {/* Step 1: Python Packages */}
                {customEEStep === 1 && customEEForm.import_mode === 'wizard' && (
                  <div>
                    <Text style={{ marginBottom: '16px' }}>
                      Add Python packages that your execution environment needs. You can use templates for common use cases or add custom packages.
                    </Text>
                    
                    <Alert variant="info" title="Package Templates" isInline style={{ marginBottom: '16px' }}>
                      Templates provide common package combinations used in production environments. 
                      Some packages may require additional system dependencies or specific base image configurations.
                    </Alert>
                    
                    {packageTemplates ? (
                      <div style={{ marginBottom: '20px' }}>
                        <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>Quick Templates</Title>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {Object.entries(packageTemplates.python_packages).map(([template, packages]) => (
                            <Button
                              key={template}
                              variant="secondary"
                              size="sm"
                              onClick={() => addPackageFromTemplate('python_packages', template)}
                            >
                              {template.replace('_', ' ')} ({packages.length})
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                        <Spinner size="sm" />
                        <Text component="small" style={{ marginLeft: '8px' }}>Loading package templates...</Text>
                      </div>
                    )}
                    
                    <FormGroup label="Add Custom Package" fieldId="custom-python">
                      <Split hasGutter>
                        <SplitItem isFilled>
                          <TextInput
                            id="custom-python"
                            type="text"
                            placeholder="package-name>=1.0.0"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addCustomPackage('python_packages', (e.target as HTMLInputElement).value);
                                (e.target as HTMLInputElement).value = '';
                              }
                            }}
                          />
                        </SplitItem>
                        <SplitItem>
                          <Button
                            variant="primary"
                            onClick={() => {
                              const input = document.getElementById('custom-python') as HTMLInputElement;
                              addCustomPackage('python_packages', input.value);
                              input.value = '';
                            }}
                          >
                            Add
                          </Button>
                        </SplitItem>
                      </Split>
                    </FormGroup>
                    
                    <div style={{ marginTop: '20px' }}>
                      <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>
                        Selected Packages ({customEEForm.python_packages.length})
                      </Title>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {customEEForm.python_packages.map((pkg, index) => (
                          <Label 
                            key={index} 
                            color="blue" 
                            onClose={() => removePackage('python_packages', pkg)}
                          >
                            {pkg}
                          </Label>
                        ))}
                        {customEEForm.python_packages.length === 0 && (
                          <Text component="small" style={{ color: '#6a6e73' }}>No Python packages selected</Text>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: System Packages */}
                {customEEForm.import_mode === 'wizard' && customEEStep === 2 && (
                  <div>
                    <Text style={{ marginBottom: '16px' }}>
                      Add system packages (RPMs) that your execution environment needs. These are installed using microdnf/dnf.
                    </Text>
                    
                    <Alert variant="info" title="System Dependencies" isInline style={{ marginBottom: '16px' }}>
                      System packages provide libraries and tools required by Python packages and Ansible collections. 
                      Development packages (gcc, python3-devel, etc.) are often needed for packages that compile native extensions.
                      <br/><strong>Note:</strong> openssh-clients and sshpass are included by default for Ansible connectivity.
                    </Alert>
                    
                    {packageTemplates ? (
                      <div style={{ marginBottom: '20px' }}>
                        <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>Quick Templates</Title>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {Object.entries(packageTemplates.system_packages).map(([template, packages]) => (
                            <Button
                              key={template}
                              variant="secondary"
                              size="sm"
                              onClick={() => addPackageFromTemplate('system_packages', template)}
                            >
                              {template.replace('_', ' ')} ({packages.length})
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                        <Spinner size="sm" />
                        <Text component="small" style={{ marginLeft: '8px' }}>Loading package templates...</Text>
                      </div>
                    )}
                    
                    <FormGroup label="Add Custom Package" fieldId="custom-system">
                      <Split hasGutter>
                        <SplitItem isFilled>
                          <TextInput
                            id="custom-system"
                            type="text"
                            placeholder="package-name"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addCustomPackage('system_packages', (e.target as HTMLInputElement).value);
                                (e.target as HTMLInputElement).value = '';
                              }
                            }}
                          />
                        </SplitItem>
                        <SplitItem>
                          <Button
                            variant="primary"
                            onClick={() => {
                              const input = document.getElementById('custom-system') as HTMLInputElement;
                              addCustomPackage('system_packages', input.value);
                              input.value = '';
                            }}
                          >
                            Add
                          </Button>
                        </SplitItem>
                      </Split>
                    </FormGroup>
                    
                    <div style={{ marginTop: '20px' }}>
                      <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>
                        Selected Packages ({customEEForm.system_packages.length})
                      </Title>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {customEEForm.system_packages.map((pkg, index) => (
                          <Label 
                            key={index} 
                            color="orange" 
                            onClose={() => removePackage('system_packages', pkg)}
                          >
                            {pkg}
                          </Label>
                        ))}
                        {customEEForm.system_packages.length === 0 && (
                          <Text component="small" style={{ color: '#6a6e73' }}>No system packages selected</Text>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Ansible Collections */}
                {customEEForm.import_mode === 'wizard' && customEEStep === 3 && (
                  <div>
                    <Text style={{ marginBottom: '16px' }}>
                      Add Ansible collections that your execution environment needs. Collections provide modules, plugins, and roles.
                    </Text>
                    
                    {packageTemplates ? (
                      <div style={{ marginBottom: '20px' }}>
                        <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>Quick Templates</Title>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {Object.entries(packageTemplates.ansible_collections).map(([template, collections]) => (
                            <Button
                              key={template}
                              variant="secondary"
                              size="sm"
                              onClick={() => addPackageFromTemplate('ansible_collections', template)}
                            >
                              {template.replace('_', ' ')} ({collections.length})
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                        <Spinner size="sm" />
                        <Text component="small" style={{ marginLeft: '8px' }}>Loading collection templates...</Text>
                      </div>
                    )}
                    
                    <FormGroup label="Add Custom Collection" fieldId="custom-collection">
                      <Split hasGutter>
                        <SplitItem isFilled>
                          <TextInput
                            id="custom-collection"
                            type="text"
                            placeholder="namespace.collection:>=1.0.0"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addCustomPackage('ansible_collections', (e.target as HTMLInputElement).value);
                                (e.target as HTMLInputElement).value = '';
                              }
                            }}
                          />
                        </SplitItem>
                        <SplitItem>
                          <Button
                            variant="primary"
                            onClick={() => {
                              const input = document.getElementById('custom-collection') as HTMLInputElement;
                              addCustomPackage('ansible_collections', input.value);
                              input.value = '';
                            }}
                          >
                            Add
                          </Button>
                        </SplitItem>
                      </Split>
                    </FormGroup>
                    
                    <div style={{ marginTop: '20px' }}>
                      <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>
                        Selected Collections ({customEEForm.ansible_collections.length})
                      </Title>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {customEEForm.ansible_collections.map((col, index) => (
                          <Label 
                            key={index} 
                            color="purple" 
                            onClose={() => removePackage('ansible_collections', col)}
                          >
                            {col}
                          </Label>
                        ))}
                        {customEEForm.ansible_collections.length === 0 && (
                          <Text component="small" style={{ color: '#6a6e73' }}>No Ansible collections selected</Text>
                        )}
                      </div>
                    </div>
                    
                    {/* Advanced Options - Optional */}
                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #d2d2d2' }}>
                      <ExpandableSection toggleText="🔧 Advanced Options (Optional)">
                        <FormGroup label="Additional Build Steps" fieldId="build-steps" style={{ marginTop: '12px' }}>
                          <TextArea
                            id="build-steps"
                            value={customEEForm.additional_build_steps}
                            onChange={(event, value) => setCustomEEForm(prev => ({ ...prev, additional_build_steps: value }))}
                            placeholder={`RUN microdnf install -y curl
RUN pip install --upgrade pip
USER 1001`}
                            rows={4}
                          />
                          <Text component="small" style={{ color: '#6a6e73' }}>
                            Add custom RUN, COPY, or other Dockerfile commands. These will be executed at the end of the build process.
                          </Text>
                        </FormGroup>
                      </ExpandableSection>
                    </div>
                  </div>
                )}

                {/* Review Step - Step 4 for wizard mode, Step 1 for YAML mode */}
                {((customEEForm.import_mode === 'wizard' && customEEStep === 4) || 
                  (customEEForm.import_mode === 'yaml' && customEEStep === 1)) && (
                  <div>
                    <Alert variant="success" title="Review Your Custom Execution Environment" isInline style={{ marginBottom: '20px' }}>
                      Please review the configuration and generated files below before creating your execution environment.
                    </Alert>
                    
                    {/* Red Hat Registry Authentication Check */}
                    {(() => {
                      let finalBaseImage = '';
                      
                      if (customEEForm.import_mode === 'yaml') {
                        // Extract base image from YAML content using the helper function
                        finalBaseImage = extractBaseImageFromYAML(customEEForm.yaml_content);
                      } else {
                        finalBaseImage = customEEForm.use_custom_base_image ? 
                          customEEForm.custom_base_image : 
                          customEEForm.base_image;
                      }
                      
                      const isRedHatRegistry = finalBaseImage?.includes('registry.redhat.io');
                      
                      if (isRedHatRegistry && rhAuthStatus !== 'authenticated') {
                        return (
                          <Alert variant="warning" title="Red Hat Registry Authentication Required" isInline style={{ marginBottom: '20px' }}>
                            Your configuration requires authentication with registry.redhat.io. 
                            <Button 
                              variant="link" 
                              isInline 
                              onClick={() => setIsRHAuthModalOpen(true)}
                              style={{ marginLeft: '8px', padding: '0' }}
                            >
                              Please login now
                            </Button>
                          </Alert>
                        );
                      }
                      return null;
                    })()}
                    
                    <Grid hasGutter>
                      <GridItem span={6}>
                        <Card>
                          <CardTitle>Environment Summary</CardTitle>
                          <CardBody>
                            <DescriptionList>
                              <DescriptionListGroup>
                                <DescriptionListTerm>Name</DescriptionListTerm>
                                <DescriptionListDescription style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                  {customEEForm.name || 'Not specified'}
                                </DescriptionListDescription>
                              </DescriptionListGroup>
                              
                              {customEEForm.import_mode === 'wizard' && (
                                <>
                                  <DescriptionListGroup>
                                    <DescriptionListTerm>Description</DescriptionListTerm>
                                    <DescriptionListDescription>{customEEForm.description || 'No description'}</DescriptionListDescription>
                                  </DescriptionListGroup>
                                  <DescriptionListGroup>
                                    <DescriptionListTerm>Base Image</DescriptionListTerm>
                                    <DescriptionListDescription style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                                      {customEEForm.use_custom_base_image ? 
                                        customEEForm.custom_base_image || 'Not specified' : 
                                        customEEForm.base_image || 'Not selected'}
                                      {(() => {
                                        const finalBaseImage = customEEForm.use_custom_base_image ? 
                                          customEEForm.custom_base_image : 
                                          customEEForm.base_image;
                                        const isRedHatRegistry = finalBaseImage?.includes('registry.redhat.io');
                                        
                                        if (isRedHatRegistry) {
                                          return (
                                            <div style={{ marginTop: '4px' }}>
                                              <Label color={rhAuthStatus === 'authenticated' ? 'green' : 'orange'}>
                                                {rhAuthStatus === 'authenticated' ? '✓ RH Authenticated' : '⚠ RH Auth Required'}
                                              </Label>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </DescriptionListDescription>
                                  </DescriptionListGroup>
                                  <DescriptionListGroup>
                                    <DescriptionListTerm>Dependencies</DescriptionListTerm>
                                    <DescriptionListDescription>
                                      <div>
                                        <Label color="blue">{customEEForm.python_packages.length} Python</Label>
                                        <Label color="orange" style={{ marginLeft: '4px' }}>{customEEForm.system_packages.length + 2} System</Label>
                                        <Label color="purple" style={{ marginLeft: '4px' }}>{customEEForm.ansible_collections.length} Collections</Label>
                                        <Label color="green" style={{ marginLeft: '4px' }}>Core Ansible</Label>
                                      </div>
                                    </DescriptionListDescription>
                                  </DescriptionListGroup>
                                </>
                              )}
                              
                              {customEEForm.import_mode === 'yaml' && (
                                <DescriptionListGroup>
                                  <DescriptionListTerm>Configuration</DescriptionListTerm>
                                  <DescriptionListDescription>
                                    <Label color="blue">YAML Import (Exact Copy)</Label>
                                    <Label color="green" style={{ marginLeft: '4px' }}>
                                      {customEEForm.yaml_content.split('\n').length} lines
                                    </Label>
                                    <div style={{ marginTop: '4px' }}>
                                      <Text component="small" style={{ color: '#6a6e73' }}>
                                        Your YAML content will be written exactly to execution-environment.yml
                                      </Text>
                                    </div>
                                  </DescriptionListDescription>
                                </DescriptionListGroup>
                              )}
                              
                              <DescriptionListGroup>
                                <DescriptionListTerm>Build Options</DescriptionListTerm>
                                <DescriptionListDescription>
                                  <div>
                                    <Label color="green">Build Immediately</Label>
                                    {customEEForm.additional_build_steps && (
                                      <Label color="cyan" style={{ marginLeft: '4px' }}>Custom Build Steps</Label>
                                    )}
                                  </div>
                                </DescriptionListDescription>
                              </DescriptionListGroup>
                            </DescriptionList>
                          </CardBody>
                        </Card>
                      </GridItem>
                      
                      <GridItem span={6}>
                        <Card>
                          <CardTitle>
                            {customEEForm.import_mode === 'yaml' ? 'YAML Content (will be written exactly as shown)' : 'Files to be Created'}
                          </CardTitle>
                          <CardBody>
                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                              {customEEForm.import_mode === 'yaml' ? (
                                <>
                                  <Alert variant="info" title="Direct YAML Import" isInline style={{ marginBottom: '12px' }}>
                                    The YAML content below will be written exactly as provided to execution-environment.yml
                                  </Alert>
                                  <TextArea
                                    value={customEEForm.yaml_content}
                                    rows={12}
                                    readOnly
                                    style={{ fontFamily: 'monospace', fontSize: '10px', backgroundColor: '#f8f9fa' }}
                                  />
                                </>
                              ) : (
                                <>
                                  <ExpandableSection toggleText="📄 execution-environment.yml" isExpanded>
                                    <TextArea
                                      value={JSON.stringify(generateYAMLPreview(), null, 2).replace(/"/g, '')}
                                      rows={8}
                                      readOnly
                                      style={{ fontFamily: 'monospace', fontSize: '10px', backgroundColor: '#f8f9fa' }}
                                    />
                                  </ExpandableSection>
                                  
                                  {customEEForm.python_packages.length > 0 && (
                                    <ExpandableSection toggleText="📄 requirements.txt" style={{ marginTop: '8px' }}>
                                      <TextArea
                                        value={generateRequirementsTxt()}
                                        rows={4}
                                        readOnly
                                        style={{ fontFamily: 'monospace', fontSize: '10px', backgroundColor: '#f8f9fa' }}
                                      />
                                    </ExpandableSection>
                                  )}
                                  
                                  {customEEForm.ansible_collections.length > 0 && (
                                    <ExpandableSection toggleText="📄 requirements.yml" style={{ marginTop: '8px' }}>
                                      <TextArea
                                        value={JSON.stringify(generateRequirementsYml(), null, 2).replace(/"/g, '')}
                                        rows={4}
                                        readOnly
                                        style={{ fontFamily: 'monospace', fontSize: '10px', backgroundColor: '#f8f9fa' }}
                                      />
                                    </ExpandableSection>
                                  )}
                                  
                                  {customEEForm.system_packages.length > 0 && (
                                    <ExpandableSection toggleText="📄 bindep.txt" style={{ marginTop: '8px' }}>
                                      <TextArea
                                        value={generateBindepTxt()}
                                        rows={4}
                                        readOnly
                                        style={{ fontFamily: 'monospace', fontSize: '10px', backgroundColor: '#f8f9fa' }}
                                      />
                                    </ExpandableSection>
                                  )}
                                  
                                  {customEEForm.additional_build_steps && (
                                    <ExpandableSection toggleText="🔧 Additional Build Steps" style={{ marginTop: '8px' }}>
                                      <TextArea
                                        value={customEEForm.additional_build_steps}
                                        rows={4}
                                        readOnly
                                        style={{ fontFamily: 'monospace', fontSize: '10px', backgroundColor: '#f8f9fa' }}
                                      />
                                    </ExpandableSection>
                                  )}
                                </>
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      </GridItem>
                    </Grid>
                    
                    <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
                      <Text component="small">
                        <strong>🚀 Ready to create:</strong> The environment folder <code>environments/{customEEForm.name}</code> will be created with{' '}
                        {customEEForm.import_mode === 'yaml' ? 
                          'your exact YAML content written to execution-environment.yml.' : 
                          'all the files shown above.'
                        } The build process will start immediately after creation.
                      </Text>
                    </div>
                  </div>
                )}
              </div>
            </GridItem>
            
            {/* YAML Preview Sidebar - only show on wizard mode steps 0-3 */}
            {customEEForm.import_mode === 'wizard' && customEEStep < 4 && (
              <GridItem span={5}>
                <div style={{ position: 'sticky', top: '0' }}>
                  <Card>
                    <CardTitle>
                      <Split>
                        <SplitItem>
                          <CodeIcon style={{ marginRight: '8px' }} />
                          Live Preview
                        </SplitItem>
                        <SplitItem isFilled />
                        <SplitItem>
                          <Badge>{customEEForm.name || 'unnamed-ee'}</Badge>
                        </SplitItem>
                      </Split>
                    </CardTitle>
                    <CardBody>
                      <Tabs defaultActiveKey={0} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <Tab eventKey={0} title={<TabTitleText>execution-environment.yml</TabTitleText>}>
                          <TextArea
                            value={`# Generated execution-environment.yml\n${JSON.stringify(generateYAMLPreview(), null, 2).replace(/"/g, '')}`}
                            rows={15}
                            readOnly
                            style={{ 
                              fontFamily: 'monospace', 
                              fontSize: '11px',
                              backgroundColor: '#f8f9fa',
                              border: 'none'
                            }}
                          />
                        </Tab>
                        
                        {customEEForm.python_packages.length > 0 && (
                          <Tab eventKey={1} title={<TabTitleText>requirements.txt</TabTitleText>}>
                            <TextArea
                              value={`# Python dependencies\n${generateRequirementsTxt()}`}
                              rows={10}
                              readOnly
                              style={{ 
                                fontFamily: 'monospace', 
                                fontSize: '11px',
                                backgroundColor: '#f8f9fa',
                                border: 'none'
                              }}
                            />
                          </Tab>
                        )}
                        
                        {customEEForm.ansible_collections.length > 0 && (
                          <Tab eventKey={2} title={<TabTitleText>requirements.yml</TabTitleText>}>
                            <TextArea
                              value={`# Ansible collections\n${JSON.stringify(generateRequirementsYml(), null, 2).replace(/"/g, '')}`}
                              rows={10}
                              readOnly
                              style={{ 
                                fontFamily: 'monospace', 
                                fontSize: '11px',
                                backgroundColor: '#f8f9fa',
                                border: 'none'
                              }}
                            />
                          </Tab>
                        )}
                        
                        {customEEForm.system_packages.length > 0 && (
                          <Tab eventKey={3} title={<TabTitleText>bindep.txt</TabTitleText>}>
                            <TextArea
                              value={`# System dependencies\n${generateBindepTxt()}`}
                              rows={10}
                              readOnly
                              style={{ 
                                fontFamily: 'monospace', 
                                fontSize: '11px',
                                backgroundColor: '#f8f9fa',
                                border: 'none'
                              }}
                            />
                          </Tab>
                        )}
                      </Tabs>
                      
                      <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
                        <Text component="small">
                          <strong>📁 Files to be created:</strong><br/>
                          • execution-environment.yml<br/>
                          {customEEForm.python_packages.length > 0 && '• requirements.txt\n'}
                          {customEEForm.ansible_collections.length > 0 && '• requirements.yml\n'}
                          {customEEForm.system_packages.length > 0 && '• bindep.txt\n'}
                        </Text>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </GridItem>
            )}
          </Grid>
        </div>
      </Modal>
    </Page>
  );
};

export default App;
