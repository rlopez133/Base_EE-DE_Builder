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
  Checkbox,
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customEEStep: number;
  customEEForm: CustomEEForm;
  availableBaseImages: string[];
  packageTemplates: PackageTemplate[];
  rhAuthStatus: string;
  onSetIsRHAuthModalOpen: (open: boolean) => void;
  onCreateCustomEE: (buildRequest: EnhancedBuildRequest) => void;
  getStepTitle: (step: number) => string;
  canProceedToNextStep: (step: number) => boolean;
  nextStep: () => void;
  previousStep: () => void;
  updateFormField: (field: string, value: any) => void;
  addPackageFromTemplate: (template: PackageTemplate) => void;
  addCustomPackage: (type: 'python' | 'system' | 'ansible', packageName: string) => void;
  removePackage: (type: 'python' | 'system' | 'ansible', index: number) => void;
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
  const [activeTab, setActiveTab] = useState<string | number>(0);
  const [newPythonPackage, setNewPythonPackage] = useState('');
  const [newSystemPackage, setNewSystemPackage] = useState('');
  const [newAnsibleCollection, setNewAnsibleCollection] = useState('');

  // Destination configuration state
  const [destinationConfig, setDestinationConfig] = useState<BuildDestinationConfig>({
    destination: 'local',
    export: { enabled: false, containerRuntime: 'podman' },
    push: { enabled: false }
  });

  // Handle modal close with reset
  const handleClose = () => {
    // Reset destination config
    setDestinationConfig({
      destination: 'local',
      export: { enabled: false, containerRuntime: 'podman' },
      push: { enabled: false }
    });
    onClose();
  };

  const canCreateEE = () => {
    return customEEForm.name?.trim() !== '' && 
           customEEForm.base_image?.trim() !== '';
  };

  const handleCreateEE = () => {
    // FIXED: Create build request with custom EE name as the environment
    const buildRequest: EnhancedBuildRequest = {
      environments: [customEEForm.name], // Use the custom EE name as the environment to build
      container_runtime: destinationConfig.export?.containerRuntime || destinationConfig.push?.containerRuntime || 'podman',
      destinations: destinationConfig
    };

    onCreateCustomEE(buildRequest);
  };

  const isLastStep = customEEStep === 3;

  return (
    <Modal
      variant={ModalVariant.large}
      title="Create Custom Execution Environment"
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
            Step {customEEStep} of 3
          </Text>
        </div>

        <div style={{ minHeight: '400px' }}>
          {/* Step 1: Basic Information */}
          {customEEStep === 1 && (
            <Form>
              <FormGroup label="Name" isRequired fieldId="ee-name">
                <TextInput
                  id="ee-name"
                  value={customEEForm.name || ''}
                  onChange={(_event, value) => updateFormField('name', value)}
                  placeholder="my-custom-ee"
                />
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
              </FormGroup>
            </Form>
          )}

          {/* Step 2: Package Configuration */}
          {customEEStep === 2 && (
            <div>
              <Tabs activeKey={activeTab} onSelect={(event, tabIndex) => setActiveTab(tabIndex)}>
                <Tab eventKey={0} title={<TabTitleText>Python Packages</TabTitleText>}>
                  <div style={{ padding: '16px 0' }}>
                    <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                      <TextInput
                        value={newPythonPackage}
                        onChange={(_event, value) => setNewPythonPackage(value)}
                        placeholder="package-name==1.0.0"
                        style={{ flex: 1 }}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (newPythonPackage.trim()) {
                            addCustomPackage('python', newPythonPackage.trim());
                            setNewPythonPackage('');
                          }
                        }}
                        icon={<PlusIcon />}
                      >
                        Add
                      </Button>
                    </div>

                    {customEEForm.python_packages?.length > 0 && (
                      <div>
                        {customEEForm.python_packages.map((pkg, index) => (
                          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <Text>{pkg}</Text>
                            <Button
                              variant="plain"
                              onClick={() => removePackage('python', index)}
                              icon={<TrashIcon />}
                              size="sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {packageTemplates.filter(t => t.type === 'python').length > 0 && (
                      <ExpandableSection toggleText="Package Templates" style={{ marginTop: '16px' }}>
                        <Grid hasGutter>
                          {packageTemplates.filter(t => t.type === 'python').map(template => (
                            <GridItem span={6} key={template.name}>
                              <Card isSelectable onClick={() => addPackageFromTemplate(template)}>
                                <CardBody>
                                  <Text style={{ fontWeight: 'bold' }}>{template.name}</Text>
                                  <Text component="small">{template.description}</Text>
                                </CardBody>
                              </Card>
                            </GridItem>
                          ))}
                        </Grid>
                      </ExpandableSection>
                    )}
                  </div>
                </Tab>

                <Tab eventKey={1} title={<TabTitleText>System Packages</TabTitleText>}>
                  <div style={{ padding: '16px 0' }}>
                    <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                      <TextInput
                        value={newSystemPackage}
                        onChange={(_event, value) => setNewSystemPackage(value)}
                        placeholder="package-name"
                        style={{ flex: 1 }}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (newSystemPackage.trim()) {
                            addCustomPackage('system', newSystemPackage.trim());
                            setNewSystemPackage('');
                          }
                        }}
                        icon={<PlusIcon />}
                      >
                        Add
                      </Button>
                    </div>

                    {customEEForm.system_packages?.length > 0 && (
                      <div>
                        {customEEForm.system_packages.map((pkg, index) => (
                          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <Text>{pkg}</Text>
                            <Button
                              variant="plain"
                              onClick={() => removePackage('system', index)}
                              icon={<TrashIcon />}
                              size="sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Tab>

                <Tab eventKey={2} title={<TabTitleText>Ansible Collections</TabTitleText>}>
                  <div style={{ padding: '16px 0' }}>
                    <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                      <TextInput
                        value={newAnsibleCollection}
                        onChange={(_event, value) => setNewAnsibleCollection(value)}
                        placeholder="namespace.collection:>=1.0.0"
                        style={{ flex: 1 }}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (newAnsibleCollection.trim()) {
                            addCustomPackage('ansible', newAnsibleCollection.trim());
                            setNewAnsibleCollection('');
                          }
                        }}
                        icon={<PlusIcon />}
                      >
                        Add
                      </Button>
                    </div>

                    {customEEForm.ansible_collections?.length > 0 && (
                      <div>
                        {customEEForm.ansible_collections.map((collection, index) => (
                          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <Text>{collection}</Text>
                            <Button
                              variant="plain"
                              onClick={() => removePackage('ansible', index)}
                              icon={<TrashIcon />}
                              size="sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Tab>

                <Tab eventKey={3} title={<TabTitleText>Preview</TabTitleText>}>
                  <div style={{ padding: '16px 0' }}>
                    <Tabs>
                      <Tab eventKey={0} title="execution-environment.yml">
                        <pre style={{ background: '#f8f8f8', padding: '16px', borderRadius: '4px', fontSize: '12px', overflow: 'auto' }}>
                          {generateYAMLPreview()}
                        </pre>
                      </Tab>
                      <Tab eventKey={1} title="requirements.txt">
                        <pre style={{ background: '#f8f8f8', padding: '16px', borderRadius: '4px', fontSize: '12px', overflow: 'auto' }}>
                          {generateRequirementsTxt()}
                        </pre>
                      </Tab>
                      <Tab eventKey={2} title="requirements.yml">
                        <pre style={{ background: '#f8f8f8', padding: '16px', borderRadius: '4px', fontSize: '12px', overflow: 'auto' }}>
                          {generateRequirementsYml()}
                        </pre>
                      </Tab>
                      <Tab eventKey={3} title="bindep.txt">
                        <pre style={{ background: '#f8f8f8', padding: '16px', borderRadius: '4px', fontSize: '12px', overflow: 'auto' }}>
                          {generateBindepTxt()}
                        </pre>
                      </Tab>
                    </Tabs>
                  </div>
                </Tab>
              </Tabs>
            </div>
          )}

          {/* Step 3: Build Destination */}
          {customEEStep === 3 && (
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

                {/* Export Configuration - Runtime Selection */}
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
