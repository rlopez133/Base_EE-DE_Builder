import React, { useState } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Alert,
  Form,
  FormGroup,
  TextInput,
  TextArea,
  Grid,
  GridItem,
  Card,
  CardTitle,
  CardBody,
  Text,
  Title,
  Split,
  SplitItem,
  Label,
  Spinner,
  ExpandableSection,
  Badge,
  Tabs,
  Tab,
  TabTitleText,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription
} from '@patternfly/react-core';

import {
  CubesIcon,
  PlusIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TimesIcon,
  InfoCircleIcon,
  ExternalLinkAltIcon,
  CodeIcon,
  CopyIcon
} from '@patternfly/react-icons';

import { CustomEEForm } from '../../types';
import { EnhancedBuildRequest, BuildDestinationConfig } from '../../types/BuildDestination';

interface PackageTemplate {
  name: string;
  type: string;
  description?: string;
}

interface PackageTemplates {
  python_packages: Record<string, string[]>;
  system_packages: Record<string, string[]>;
  ansible_collections: Record<string, string[]>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customEEStep: number;
  customEEForm: CustomEEForm;
  availableBaseImages: string[];
  packageTemplates: PackageTemplates | null;
  rhAuthStatus: string;
  onSetIsRHAuthModalOpen: (open: boolean) => void;
  onCreateCustomEE: (buildRequest: EnhancedBuildRequest) => void;
  getStepTitle: (step: number) => string;
  canProceedToNextStep: (step: number) => boolean;
  nextStep: () => void;
  previousStep: () => void;
  updateFormField: (field: string, value: any) => void;
  addPackageFromTemplate: (template: PackageTemplate) => void;
  addCustomPackage: (type: 'python_packages' | 'system_packages' | 'ansible_collections', packageName: string) => void;
  removePackage: (type: 'python_packages' | 'system_packages' | 'ansible_collections', packageName: string) => void;
  extractBaseImageFromYAML: (yaml: string) => string;
  generateYAMLPreview: () => string;
  generateRequirementsTxt: () => string;
  generateRequirementsYml: () => string;
  generateBindepTxt: () => string;
}

const CustomEEWizardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  customEEStep,
  customEEForm,
  availableBaseImages,
  packageTemplates,
  rhAuthStatus,
  onSetIsRHAuthModalOpen,
  onCreateCustomEE,
  getStepTitle,
  canProceedToNextStep,
  nextStep,
  previousStep,
  updateFormField,
  addPackageFromTemplate,
  addCustomPackage,
  removePackage,
  extractBaseImageFromYAML,
  generateYAMLPreview,
  generateRequirementsTxt,
  generateRequirementsYml,
  generateBindepTxt
}) => {
  const [newPythonPackage, setNewPythonPackage] = useState('');
  const [newSystemPackage, setNewSystemPackage] = useState('');
  const [newAnsibleCollection, setNewAnsibleCollection] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());

  // Destination configuration state
  const [destinationConfig, setDestinationConfig] = useState<BuildDestinationConfig>({
    destination: 'local',
    export: { enabled: false, containerRuntime: 'podman' },
    push: { enabled: false }
  });

  // Helper function to check if a template's packages are all present
  const isTemplateSelected = (templateName: string, templatePackages: string[], packageType: 'python_packages' | 'system_packages' | 'ansible_collections') => {
    const currentPackages = customEEForm[packageType] || [];
    return templatePackages.every(pkg => currentPackages.includes(pkg));
  };

  // Helper function to remove all packages from a template
  const removeTemplatePackages = (templateName: string, templatePackages: string[], packageType: 'python_packages' | 'system_packages' | 'ansible_collections') => {
    templatePackages.forEach(pkg => {
      removePackage(packageType, pkg);
    });
    setSelectedTemplates(prev => {
      const newSet = new Set(prev);
      newSet.delete(`${packageType}-${templateName}`);
      return newSet;
    });
  };

  // Enhanced template handler
  const handleTemplateClick = (templateName: string, templatePackages: string[], packageType: 'python_packages' | 'system_packages' | 'ansible_collections') => {
    const templateKey = `${packageType}-${templateName}`;
    const isSelected = isTemplateSelected(templateName, templatePackages, packageType);
    
    if (isSelected) {
      // Remove template packages
      removeTemplatePackages(templateName, templatePackages, packageType);
    } else {
      // Add template packages
      addPackageFromTemplate({ name: templateName, type: packageType.split('_')[0] });
      setSelectedTemplates(prev => new Set(prev).add(templateKey));
    }
  };

  // Handle modal close with reset
  const handleClose = () => {
    // Reset destination config
    setDestinationConfig({
      destination: 'local',
      export: { enabled: false, containerRuntime: 'podman' },
      push: { enabled: false }
    });
    // Reset selected templates
    setSelectedTemplates(new Set());
    onClose();
  };

  const canCreateEE = () => {
    return customEEForm.name?.trim() !== '' && 
           customEEForm.base_image?.trim() !== '';
  };

  const handleCreateEE = () => {
    // Create build request with custom EE name as the environment
    const buildRequest: EnhancedBuildRequest = {
      environments: [customEEForm.name], // Use the custom EE name as the environment to build
      container_runtime: destinationConfig.export?.containerRuntime || destinationConfig.push?.containerRuntime || 'podman',
      destinations: destinationConfig
    };

    onCreateCustomEE(buildRequest);
  };

  const isLastStep = customEEStep === 5;

  return (
    <Modal
      variant={ModalVariant.large}
      title={`Create Custom EE - Step ${customEEStep}/5: ${getStepTitle(customEEStep)}`}
      isOpen={isOpen}
      onClose={handleClose}
      hasNoBodyWrapper
    >
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <Text component="h1" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            {getStepTitle(customEEStep)}
          </Text>
          <Text component="small" style={{ color: '#6a6e73' }}>
            Step {customEEStep} of 5
          </Text>
        </div>

        <div style={{ minHeight: '400px' }}>
          <Grid hasGutter>
            {/* Main Content */}
            <GridItem span={customEEStep === 5 ? 12 : 7}>
              <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
                
                {/* Step 1: Basic Information */}
                {customEEStep === 1 && (
                  <div>
                    <Alert variant="info" title="Create Your Custom Execution Environment" isInline style={{ marginBottom: '20px' }}>
                      This wizard will help you create a custom Execution Environment with your specific dependencies and tools.
                    </Alert>
                
                    <Form>
                      <FormGroup label="Environment Name" isRequired fieldId="ee-name">
                        <TextInput
                          id="ee-name"
                          value={customEEForm.name || ''}
                          onChange={(_event, value) => updateFormField('name', value)}
                          placeholder="my-custom-ee"
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
                          value={customEEForm.description || ''}
                          onChange={(_event, value) => updateFormField('description', value)}
                          placeholder="Describe your custom execution environment..."
                        />
                      </FormGroup>

                      <FormGroup label="Base Image" isRequired fieldId="ee-base-image">
                        <select
                          id="ee-base-image"
                          value={customEEForm.base_image || ''}
                          onChange={(e) => updateFormField('base_image', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        >
                          <option value="">Select a base image...</option>
                          {availableBaseImages.map(image => (
                            <option key={image} value={image}>
                              {image}
                            </option>
                          ))}
                        </select>
                        
                        {/* Show Red Hat auth warning for selected images */}
                        {customEEForm.base_image?.includes('registry.redhat.io') && rhAuthStatus !== 'authenticated' && (
                          <Alert variant="warning" title="Red Hat Registry Authentication Required" isInline style={{ marginTop: '12px' }}>
                            The selected base image requires Red Hat registry authentication. 
                            <Button 
                              variant="link" 
                              isInline 
                              onClick={() => onSetIsRHAuthModalOpen(true)}
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

                {/* Step 2: Python Packages */}
                {customEEStep === 2 && (
                  <div>
                    <Text style={{ marginBottom: '16px' }}>
                      Add Python packages that your execution environment needs. You can use templates for common use cases or add custom packages.
                    </Text>
                    
                    <Alert variant="info" title="Package Templates" isInline style={{ marginBottom: '16px' }}>
                      Templates provide common package combinations used in production environments. 
                      <strong>Click to add packages, click again to remove them.</strong>
                      Some packages may require additional system dependencies or specific base image configurations.
                    </Alert>
                    
                    {packageTemplates ? (
                      <div style={{ marginBottom: '20px' }}>
                        <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>Quick Templates</Title>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {Object.entries(packageTemplates.python_packages || {}).map(([template, packages]: [string, any]) => {
                            const isSelected = isTemplateSelected(template, packages, 'python_packages');
                            return (
                              <Button
                                key={template}
                                variant={isSelected ? "primary" : "secondary"}
                                size="sm"
                                onClick={() => handleTemplateClick(template, packages, 'python_packages')}
                              >
                                {isSelected && "✓ "}{template.replace('_', ' ')} ({packages.length})
                              </Button>
                            );
                          })}
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
                            value={newPythonPackage}
                            onChange={(_event, value) => setNewPythonPackage(value)}
                            placeholder="package-name>=1.0.0"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addCustomPackage('python_packages', newPythonPackage.trim());
                                setNewPythonPackage('');
                              }
                            }}
                          />
                        </SplitItem>
                        <SplitItem>
                          <Button
                            variant="primary"
                            onClick={() => {
                              if (newPythonPackage.trim()) {
                                addCustomPackage('python_packages', newPythonPackage.trim());
                                setNewPythonPackage('');
                              }
                            }}
                          >
                            Add
                          </Button>
                        </SplitItem>
                      </Split>
                    </FormGroup>
                    
                    <div style={{ marginTop: '20px' }}>
                      <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>
                        Selected Packages ({customEEForm.python_packages?.length || 0})
                      </Title>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {customEEForm.python_packages?.map((pkg: string, index: number) => (
                          <Label 
                            key={index} 
                            color="blue" 
                            onClose={() => removePackage('python_packages', pkg)}
                          >
                            {pkg}
                          </Label>
                        ))}
                        {(!customEEForm.python_packages || customEEForm.python_packages.length === 0) && (
                          <Text component="small" style={{ color: '#6a6e73' }}>No Python packages selected</Text>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: System Packages */}
                {customEEStep === 3 && (
                  <div>
                    <Text style={{ marginBottom: '16px' }}>
                      Add system packages (RPMs) that your execution environment needs. These are installed using microdnf/dnf.
                    </Text>
                    
                    <Alert variant="info" title="System Dependencies" isInline style={{ marginBottom: '16px' }}>
                      System packages provide libraries and tools required by Python packages and Ansible collections. 
                      <strong>Click templates to add/remove packages.</strong> 
                      Development packages (gcc, python3-devel, etc.) are often needed for packages that compile native extensions.
                      <br/><strong>Note:</strong> openssh-clients and sshpass are included by default for Ansible connectivity.
                    </Alert>
                    
                    {packageTemplates ? (
                      <div style={{ marginBottom: '20px' }}>
                        <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>Quick Templates</Title>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {Object.entries(packageTemplates.system_packages || {}).map(([template, packages]: [string, any]) => {
                            const isSelected = isTemplateSelected(template, packages, 'system_packages');
                            return (
                              <Button
                                key={template}
                                variant={isSelected ? "primary" : "secondary"}
                                size="sm"
                                onClick={() => handleTemplateClick(template, packages, 'system_packages')}
                              >
                                {isSelected && "✓ "}{template.replace('_', ' ')} ({packages.length})
                              </Button>
                            );
                          })}
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
                            value={newSystemPackage}
                            onChange={(_event, value) => setNewSystemPackage(value)}
                            placeholder="package-name"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addCustomPackage('system_packages', newSystemPackage.trim());
                                setNewSystemPackage('');
                              }
                            }}
                          />
                        </SplitItem>
                        <SplitItem>
                          <Button
                            variant="primary"
                            onClick={() => {
                              if (newSystemPackage.trim()) {
                                addCustomPackage('system_packages', newSystemPackage.trim());
                                setNewSystemPackage('');
                              }
                            }}
                          >
                            Add
                          </Button>
                        </SplitItem>
                      </Split>
                    </FormGroup>
                    
                    <div style={{ marginTop: '20px' }}>
                      <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>
                        Selected Packages ({customEEForm.system_packages?.length || 0})
                      </Title>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {customEEForm.system_packages?.map((pkg: string, index: number) => (
                          <Label 
                            key={index} 
                            color="orange" 
                            onClose={() => removePackage('system_packages', pkg)}
                          >
                            {pkg}
                          </Label>
                        ))}
                        {(!customEEForm.system_packages || customEEForm.system_packages.length === 0) && (
                          <Text component="small" style={{ color: '#6a6e73' }}>No system packages selected</Text>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Ansible Collections */}
                {customEEStep === 4 && (
                  <div>
                    <Text style={{ marginBottom: '16px' }}>
                      Add Ansible collections that your execution environment needs. Collections provide modules, plugins, and roles.
                      <strong> Click templates to add/remove collections.</strong>
                    </Text>
                    
                    {packageTemplates ? (
                      <div style={{ marginBottom: '20px' }}>
                        <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>Quick Templates</Title>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {Object.entries(packageTemplates.ansible_collections || {}).map(([template, collections]: [string, any]) => {
                            const isSelected = isTemplateSelected(template, collections, 'ansible_collections');
                            return (
                              <Button
                                key={template}
                                variant={isSelected ? "primary" : "secondary"}
                                size="sm"
                                onClick={() => handleTemplateClick(template, collections, 'ansible_collections')}
                              >
                                {isSelected && "✓ "}{template.replace('_', ' ')} ({collections.length})
                              </Button>
                            );
                          })}
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
                            value={newAnsibleCollection}
                            onChange={(_event, value) => setNewAnsibleCollection(value)}
                            placeholder="namespace.collection:>=1.0.0"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addCustomPackage('ansible_collections', newAnsibleCollection.trim());
                                setNewAnsibleCollection('');
                              }
                            }}
                          />
                        </SplitItem>
                        <SplitItem>
                          <Button
                            variant="primary"
                            onClick={() => {
                              if (newAnsibleCollection.trim()) {
                                addCustomPackage('ansible_collections', newAnsibleCollection.trim());
                                setNewAnsibleCollection('');
                              }
                            }}
                          >
                            Add
                          </Button>
                        </SplitItem>
                      </Split>
                    </FormGroup>
                    
                    <div style={{ marginTop: '20px' }}>
                      <Title headingLevel="h4" size="md" style={{ marginBottom: '12px' }}>
                        Selected Collections ({customEEForm.ansible_collections?.length || 0})
                      </Title>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {customEEForm.ansible_collections?.map((col: string, index: number) => (
                          <Label 
                            key={index} 
                            color="purple" 
                            onClose={() => removePackage('ansible_collections', col)}
                          >
                            {col}
                          </Label>
                        ))}
                        {(!customEEForm.ansible_collections || customEEForm.ansible_collections.length === 0) && (
                          <Text component="small" style={{ color: '#6a6e73' }}>No Ansible collections selected</Text>
                        )}
                      </div>
                    </div>

                    {/* Advanced Options - moved to this step */}
                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #d2d2d2' }}>
                      <ExpandableSection toggleText="🔧 Advanced Options (Optional)">
                        <FormGroup label="Additional Build Steps" fieldId="build-steps" style={{ marginTop: '12px' }}>
                          <TextArea
                            id="build-steps"
                            value={customEEForm.additional_build_steps || ''}
                            onChange={(_event, value) => updateFormField('additional_build_steps', value)}
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

                {/* Step 5: Build Destination */}
                {customEEStep === 5 && (
                  <div>
                    <Title headingLevel="h4" size="md" style={{ marginBottom: '16px' }}>
                      Build Destination
                    </Title>
                    
                    {/* Show what we're building */}
                    <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                      <Text style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                        Building Custom EE: {customEEForm.name || 'Unnamed EE'}
                      </Text>
                      <Text component="small" style={{ color: '#6a6e73' }}>
                        Based on: {customEEForm.base_image || 'No base image selected'}
                      </Text>
                    </div>
                    
                    <Grid hasGutter>
                      <GridItem span={12}>
                        <Card 
                          isSelectable 
                          isSelected={destinationConfig.destination === 'local'}
                          onClick={() => setDestinationConfig({
                            destination: 'local',
                            export: { enabled: false, containerRuntime: 'podman' },
                            push: { enabled: false }
                          })}
                          style={{ cursor: 'pointer', marginBottom: '16px' }}
                        >
                          <CardBody>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <input 
                                type="radio" 
                                checked={destinationConfig.destination === 'local'} 
                                onChange={() => {}}
                                style={{ marginRight: '12px' }}
                              />
                              <span style={{ marginRight: '12px', fontSize: '20px' }}>🏠</span>
                              <div>
                                <Text style={{ fontWeight: 'bold' }}>Build Locally</Text>
                                <Text component="small" style={{ color: '#6a6e73' }}>
                                  Build and store on this machine
                                </Text>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      </GridItem>

                      <GridItem span={12}>
                        <Card 
                          isSelectable 
                          isSelected={destinationConfig.destination === 'export'}
                          onClick={() => setDestinationConfig({
                            destination: 'export',
                            export: { enabled: true, containerRuntime: 'podman' },
                            push: { enabled: false }
                          })}
                          style={{ cursor: 'pointer', marginBottom: '16px' }}
                        >
                          <CardBody>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <input 
                                type="radio" 
                                checked={destinationConfig.destination === 'export'} 
                                onChange={() => {}}
                                style={{ marginRight: '12px' }}
                              />
                              <span style={{ marginRight: '12px', fontSize: '20px' }}>📥</span>
                              <div>
                                <Text style={{ fontWeight: 'bold' }}>Build & Export</Text>
                                <Text component="small" style={{ color: '#6a6e73' }}>
                                  Build locally and export as downloadable .tar file
                                </Text>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      </GridItem>

                      <GridItem span={12}>
                        <Card 
                          isSelectable 
                          isSelected={destinationConfig.destination === 'push'}
                          onClick={() => setDestinationConfig({
                            destination: 'push',
                            export: { enabled: false, containerRuntime: 'podman' },
                            push: { 
                              enabled: true, 
                              containerRuntime: 'podman',
                              registryUrl: 'quay.io',
                              repository: '',
                              tag: 'latest',
                              credentials: { username: '', password: '' }
                            }
                          })}
                          style={{ cursor: 'pointer' }}
                        >
                          <CardBody>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <input 
                                type="radio" 
                                checked={destinationConfig.destination === 'push'} 
                                onChange={() => {}}
                                style={{ marginRight: '12px' }}
                              />
                              <span style={{ marginRight: '12px', fontSize: '20px' }}>☁️</span>
                              <div>
                                <Text style={{ fontWeight: 'bold' }}>Build & Push to Registry</Text>
                                <Text component="small" style={{ color: '#6a6e73' }}>
                                  Build and push directly to a container registry
                                </Text>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      </GridItem>

                      {/* Export Configuration */}
                      {destinationConfig.destination === 'export' && (
                        <GridItem span={12}>
                          <Card style={{ marginTop: '20px' }}>
                            <CardBody>
                              <Title headingLevel="h4" size="md" style={{ marginBottom: '16px' }}>
                                Export Configuration
                              </Title>
                              <FormGroup label="Container Runtime" isRequired fieldId="runtime">
                                <div style={{ display: 'flex', gap: '20px' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                      type="radio"
                                      value="podman"
                                      checked={destinationConfig.export?.containerRuntime === 'podman'}
                                      onChange={() => setDestinationConfig({
                                        ...destinationConfig,
                                        export: {
                                          ...destinationConfig.export!,
                                          containerRuntime: 'podman'
                                        }
                                      })}
                                      style={{ marginRight: '8px' }}
                                    />
                                    Podman
                                  </label>
                                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                      type="radio"
                                      value="docker"
                                      checked={destinationConfig.export?.containerRuntime === 'docker'}
                                      onChange={() => setDestinationConfig({
                                        ...destinationConfig,
                                        export: {
                                          ...destinationConfig.export!,
                                          containerRuntime: 'docker'
                                        }
                                      })}
                                      style={{ marginRight: '8px' }}
                                    />
                                    Docker
                                  </label>
                                </div>
                              </FormGroup>
                            </CardBody>
                          </Card>
                        </GridItem>
                      )}

                      {/* Registry Configuration for Push option */}
                      {destinationConfig.destination === 'push' && (
                        <GridItem span={12}>
                          <Card style={{ marginTop: '20px' }}>
                            <CardBody>
                              <Title headingLevel="h4" size="md" style={{ marginBottom: '16px' }}>
                                Registry Configuration
                              </Title>
                              
                              <Grid hasGutter>
                                <GridItem span={12}>
                                  <FormGroup label="Registry" isRequired fieldId="registry">
                                    <select
                                      id="registry"
                                      value={destinationConfig.push?.registryUrl || 'quay.io'}
                                      onChange={(e) => setDestinationConfig({
                                        ...destinationConfig,
                                        push: {
                                          ...destinationConfig.push!,
                                          registryUrl: e.target.value
                                        }
                                      })}
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                      }}
                                    >
                                      <option value="quay.io">Quay.io</option>
                                      <option value="docker.io">Docker Hub</option>
                                      <option value="registry.redhat.io">Red Hat Registry</option>
                                      <option value="ghcr.io">GitHub Container Registry</option>
                                      <option value="gcr.io">Google Container Registry</option>
                                      <option value="custom">Custom Registry</option>
                                    </select>
                                  </FormGroup>
                                </GridItem>

                                {(destinationConfig.push?.registryUrl === 'custom') && (
                                  <GridItem span={12}>
                                    <FormGroup label="Custom Registry URL" isRequired fieldId="customRegistryUrl">
                                      <TextInput
                                        id="customRegistryUrl"
                                        value={(destinationConfig.push as any)?.customRegistryUrl || ''}
                                        onChange={(_event, value) => setDestinationConfig({
                                          ...destinationConfig,
                                          push: {
                                            ...destinationConfig.push!,
                                            customRegistryUrl: value
                                          } as any
                                        })}
                                        placeholder="registry.example.com"
                                      />
                                    </FormGroup>
                                  </GridItem>
                                )}

                                <GridItem span={6}>
                                  <FormGroup label="Repository" isRequired fieldId="repository">
                                    <TextInput
                                      id="repository"
                                      value={destinationConfig.push?.repository || ''}
                                      onChange={(_event, value) => setDestinationConfig({
                                        ...destinationConfig,
                                        push: {
                                          ...destinationConfig.push!,
                                          repository: value
                                        }
                                      })}
                                      placeholder="my-username/my-repository"
                                    />
                                  </FormGroup>
                                </GridItem>

                                <GridItem span={6}>
                                  <FormGroup label="Tag" isRequired fieldId="tag">
                                    <TextInput
                                      id="tag"
                                      value={destinationConfig.push?.tag || 'latest'}
                                      onChange={(_event, value) => setDestinationConfig({
                                        ...destinationConfig,
                                        push: {
                                          ...destinationConfig.push!,
                                          tag: value
                                        }
                                      })}
                                      placeholder="latest"
                                    />
                                  </FormGroup>
                                </GridItem>

                                <GridItem span={6}>
                                  <FormGroup label="Username" isRequired fieldId="username">
                                    <TextInput
                                      id="username"
                                      value={destinationConfig.push?.credentials?.username || ''}
                                      onChange={(_event, value) => setDestinationConfig({
                                        ...destinationConfig,
                                        push: {
                                          ...destinationConfig.push!,
                                          credentials: {
                                            username: value,
                                            password: destinationConfig.push!.credentials?.password || ''
                                          }
                                        }
                                      })}
                                      placeholder="registry-username"
                                    />
                                  </FormGroup>
                                </GridItem>

                                <GridItem span={6}>
                                  <FormGroup label="Password/Token" isRequired fieldId="password">
                                    <TextInput
                                      id="password"
                                      type="password"
                                      value={destinationConfig.push?.credentials?.password || ''}
                                      onChange={(_event, value) => setDestinationConfig({
                                        ...destinationConfig,
                                        push: {
                                          ...destinationConfig.push!,
                                          credentials: {
                                            username: destinationConfig.push!.credentials?.username || '',
                                            password: value
                                          }
                                        }
                                      })}
                                      placeholder="registry-password-or-token"
                                    />
                                  </FormGroup>
                                </GridItem>

                                <GridItem span={12}>
                                  <Button
                                    variant="secondary"
                                    onClick={() => {
                                      // Test connection logic would go here
                                      console.log('Testing connection...');
                                    }}
                                    isDisabled={
                                      !destinationConfig.push?.repository ||
                                      !destinationConfig.push?.credentials?.username ||
                                      !destinationConfig.push?.credentials?.password
                                    }
                                  >
                                    Test Connection
                                  </Button>
                                </GridItem>
                              </Grid>
                            </CardBody>
                          </Card>
                        </GridItem>
                      )}
                    </Grid>
                  </div>
                )}
              </div>
            </GridItem>
            
            {/* Live Preview Sidebar - only show on package steps 2-4 */}
            {(customEEStep >= 2 && customEEStep <= 4) && (
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
                            value={`# Generated execution-environment.yml\n${generateYAMLPreview()}`}
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
                        
                        {(customEEForm.python_packages?.length || 0) > 0 && (
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
                        
                        {(customEEForm.ansible_collections?.length || 0) > 0 && (
                          <Tab eventKey={2} title={<TabTitleText>requirements.yml</TabTitleText>}>
                            <TextArea
                              value={`# Ansible collections\n${generateRequirementsYml()}`}
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
                        
                        {(customEEForm.system_packages?.length || 0) > 0 && (
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
                          {(customEEForm.python_packages?.length || 0) > 0 && '• requirements.txt\n'}
                          {(customEEForm.ansible_collections?.length || 0) > 0 && '• requirements.yml\n'}
                          {(customEEForm.system_packages?.length || 0) > 0 && '• bindep.txt\n'}
                        </Text>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </GridItem>
            )}
          </Grid>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {customEEStep > 1 && (
              <Button variant="secondary" onClick={previousStep}>
                Back
              </Button>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="link" onClick={handleClose}>
              Cancel
            </Button>
            
            {!isLastStep ? (
              <Button 
                variant="primary" 
                onClick={nextStep}
                isDisabled={!canProceedToNextStep(customEEStep)}
              >
                Next
              </Button>
            ) : (
              <Button 
                variant="primary" 
                onClick={handleCreateEE}
                isDisabled={!canCreateEE()}
              >
                Create & Build
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CustomEEWizardModal;
