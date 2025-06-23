import React, { useState } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Alert,
  Card,
  CardBody,
  CardTitle,
  Text,
  Title,
  Grid,
  GridItem,
  Form,
  FormGroup,
  TextInput,
  Badge,
  Progress,
  ProgressSize
} from '@patternfly/react-core';

import {
  ExternalLinkAltIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@patternfly/react-icons';

import { EnhancedBuildRequest } from '../../types/BuildDestination';

interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: any;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedEnvironments: string[];
  onComplete: (buildRequest: EnhancedBuildRequest) => void;
  onCancel?: () => void;
  rhAuthStatus?: string;
  onOpenRHAuthModal?: () => void;
}

const BuildDestinationWizard: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedEnvironments,
  onComplete,
  onCancel,
  rhAuthStatus,
  onOpenRHAuthModal
}) => {
  // Wizard state - Start at step 1 (destination selection) instead of 2
  const [currentStep, setCurrentStep] = useState(1);
  const [environmentsConfig, setEnvironmentsConfig] = useState({ environments: selectedEnvironments });
  
  // Destination state
  const [destination, setDestination] = useState<'local' | 'export' | 'push'>('local');
  const [containerRuntime, setContainerRuntime] = useState<'podman' | 'docker'>('podman');

  // Registry configuration state
  const [registryType, setRegistryType] = useState('quay.io');
  const [registryUrl, setRegistryUrl] = useState('');
  const [repository, setRepository] = useState('');
  const [tag, setTag] = useState('latest');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // UI state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null);

  // Reset wizard state
  const resetWizard = () => {
    setCurrentStep(1);
    setEnvironmentsConfig({ environments: selectedEnvironments });
    setDestination('local');
    setContainerRuntime('podman');
    setRegistryType('quay.io');
    setRegistryUrl('');
    setRepository('');
    setTag('latest');
    setUsername('');
    setPassword('');
    setTestingConnection(false);
    setConnectionResult(null);
  };

  // Handle modal close
  const handleClose = () => {
    resetWizard();
    onCancel?.(); // Call onCancel if provided
    onClose();
  };

  // Test registry connection
  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch('/api/registry/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registryUrl: getEffectiveRegistryUrl(),
          username,
          password
        })
      });
      
      const result = await response.json();
      setConnectionResult(result);
    } catch (error) {
      setConnectionResult({
        success: false,
        message: 'Failed to test connection'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const getEffectiveRegistryUrl = () => {
    return registryType === 'custom' ? registryUrl : registryType;
  };

  const getDestinationDisplayName = () => {
    switch (destination) {
      case 'local': return 'Build Locally';
      case 'export': return 'Build & Export';
      case 'push': return 'Build & Push to Registry';
      default: return 'Unknown';
    }
  };

  const handleNext = () => {
    if (currentStep < 2) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleBuild = () => {
    const buildRequest: EnhancedBuildRequest = {
      environments: environmentsConfig.environments,
      container_runtime: containerRuntime,
      destinations: {
        destination,
        export: destination === 'export' ? { enabled: true, containerRuntime } : { enabled: false },
        push: destination === 'push' ? {
          enabled: true,
          containerRuntime,
          registryUrl: getEffectiveRegistryUrl(),
          repository,
          tag,
          credentials: { username, password }
        } : { enabled: false }
      }
    };

    onComplete(buildRequest);
    handleClose();
  };

  const REGISTRY_OPTIONS = [
    { value: 'quay.io', label: 'Quay.io' },
    { value: 'docker.io', label: 'Docker Hub' },
    { value: 'registry.redhat.io', label: 'Red Hat Registry' },
    { value: 'ghcr.io', label: 'GitHub Container Registry' },
    { value: 'gcr.io', label: 'Google Container Registry' },
    { value: 'custom', label: 'Custom Registry' }
  ];

  return (
    <Modal
      variant={ModalVariant.large}
      title="Build Execution Environments"
      isOpen={isOpen}
      onClose={handleClose}
      hasNoBodyWrapper
    >
      <div style={{ padding: '24px' }}>
        {/* Step 1: Destination Configuration (formerly Step 2) */}
        {currentStep === 1 && (
          <>
            <Text component="small" style={{ color: '#6a6e73', marginBottom: '16px' }}>
              Step 1 of 2
            </Text>
            <Title headingLevel="h3" size="lg" style={{ marginBottom: '16px' }}>
              Choose Build Destination
            </Title>
            
            {/* Show selected environments at the top */}
            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <Text style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                Building {selectedEnvironments.length} environment{selectedEnvironments.length !== 1 ? 's' : ''}:
              </Text>
              <div>
                {selectedEnvironments.map(env => (
                  <Badge key={env} style={{ margin: '2px 4px 2px 0' }}>
                    {env}
                  </Badge>
                ))}
              </div>
            </div>

            <Grid hasGutter>
              <GridItem span={12}>
                <Card 
                  isSelectable 
                  isSelected={destination === 'local'}
                  onClick={() => setDestination('local')}
                  style={{ cursor: 'pointer', marginBottom: '16px' }}
                >
                  <CardBody>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="radio" 
                        checked={destination === 'local'} 
                        onChange={() => setDestination('local')}
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
                  isSelected={destination === 'export'}
                  onClick={() => setDestination('export')}
                  style={{ cursor: 'pointer', marginBottom: '16px' }}
                >
                  <CardBody>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="radio" 
                        checked={destination === 'export'} 
                        onChange={() => setDestination('export')}
                        style={{ marginRight: '12px' }}
                      />
                      <span style={{ marginRight: '12px', fontSize: '20px' }}>📥</span>
                      <div>
                        <Text style={{ fontWeight: 'bold' }}>Build & Export</Text>
                        <Text component="small" style={{ color: '#6a6e73' }}>
                          Build and export as downloadable .tar file
                        </Text>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </GridItem>

              <GridItem span={12}>
                <Card 
                  isSelectable 
                  isSelected={destination === 'push'}
                  onClick={() => setDestination('push')}
                  style={{ cursor: 'pointer' }}
                >
                  <CardBody>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="radio" 
                        checked={destination === 'push'} 
                        onChange={() => setDestination('push')}
                        style={{ marginRight: '12px' }}
                      />
                      <span style={{ marginRight: '12px', fontSize: '20px' }}>☁️</span>
                      <div>
                        <Text style={{ fontWeight: 'bold' }}>Build & Push to Registry</Text>
                        <Text component="small" style={{ color: '#6a6e73' }}>
                          Build and push directly to container registry
                        </Text>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </GridItem>
            </Grid>

            {/* Local Build Configuration */}
            {destination === 'local' && (
              <Card style={{ marginTop: '20px' }}>
                <CardBody>
                  <Title headingLevel="h4" size="md" style={{ marginBottom: '16px' }}>
                    Local Build Configuration
                  </Title>
                  <FormGroup label="Container Runtime" isRequired fieldId="runtime">
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          value="podman"
                          checked={containerRuntime === 'podman'}
                          onChange={(e) => setContainerRuntime(e.target.value as 'podman' | 'docker')}
                          style={{ marginRight: '8px' }}
                        />
                        Podman
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          value="docker"
                          checked={containerRuntime === 'docker'}
                          onChange={(e) => setContainerRuntime(e.target.value as 'podman' | 'docker')}
                          style={{ marginRight: '8px' }}
                        />
                        Docker
                      </label>
                    </div>
                  </FormGroup>
                </CardBody>
              </Card>
            )}

            {/* Export Configuration */}
            {destination === 'export' && (
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
                          checked={containerRuntime === 'podman'}
                          onChange={(e) => setContainerRuntime(e.target.value as 'podman' | 'docker')}
                          style={{ marginRight: '8px' }}
                        />
                        Podman
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          value="docker"
                          checked={containerRuntime === 'docker'}
                          onChange={(e) => setContainerRuntime(e.target.value as 'podman' | 'docker')}
                          style={{ marginRight: '8px' }}
                        />
                        Docker
                      </label>
                    </div>
                  </FormGroup>
                </CardBody>
              </Card>
            )}

            {/* Registry Configuration */}
            {destination === 'push' && (
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
                          value={registryType}
                          onChange={(e) => setRegistryType(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        >
                          {REGISTRY_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormGroup>
                    </GridItem>

                    {registryType === 'custom' && (
                      <GridItem span={12}>
                        <FormGroup label="Custom Registry URL" isRequired fieldId="customRegistryUrl">
                          <TextInput
                            id="customRegistryUrl"
                            value={registryUrl}
                            onChange={(_event, value) => setRegistryUrl(value)}
                            placeholder="registry.example.com"
                          />
                        </FormGroup>
                      </GridItem>
                    )}

                    <GridItem span={6}>
                      <FormGroup label="Repository" isRequired fieldId="repository">
                        <TextInput
                          id="repository"
                          value={repository}
                          onChange={(_event, value) => setRepository(value)}
                          placeholder="my-username/my-repository"
                        />
                      </FormGroup>
                    </GridItem>

                    <GridItem span={6}>
                      <FormGroup label="Tag" isRequired fieldId="tag">
                        <TextInput
                          id="tag"
                          value={tag}
                          onChange={(_event, value) => setTag(value)}
                          placeholder="latest"
                        />
                      </FormGroup>
                    </GridItem>

                    <GridItem span={6}>
                      <FormGroup label="Username" isRequired fieldId="username">
                        <TextInput
                          id="username"
                          value={username}
                          onChange={(_event, value) => setUsername(value)}
                          placeholder="registry-username"
                        />
                      </FormGroup>
                    </GridItem>

                    <GridItem span={6}>
                      <FormGroup label="Password/Token" isRequired fieldId="password">
                        <TextInput
                          id="password"
                          type="password"
                          value={password}
                          onChange={(_event, value) => setPassword(value)}
                          placeholder="registry-password-or-token"
                        />
                      </FormGroup>
                    </GridItem>

                    <GridItem span={12}>
                      <Button
                        variant="secondary"
                        onClick={testConnection}
                        isLoading={testingConnection}
                        isDisabled={!repository || !username || !password}
                      >
                        Test Connection
                      </Button>
                      
                      {connectionResult && (
                        <Alert
                          variant={connectionResult.success ? 'success' : 'danger'}
                          title={connectionResult.message}
                          style={{ marginTop: '16px' }}
                        />
                      )}
                    </GridItem>
                  </Grid>
                </CardBody>
              </Card>
            )}

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                {/* No back button on first step */}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="link" onClick={handleClose}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleNext}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Review & Build (formerly Step 3) */}
        {currentStep === 2 && (
          <>
            <Text component="small" style={{ color: '#6a6e73', marginBottom: '16px' }}>
              Step 2 of 2
            </Text>
            <Title headingLevel="h3" size="lg" style={{ marginBottom: '24px' }}>
              Review & Build
            </Title>

            {/* Environments Summary */}
            <Card style={{ marginBottom: '20px' }}>
              <CardBody>
                <Title headingLevel="h4" size="md">
                  Selected Environments ({environmentsConfig.environments.length})
                </Title>
                <div style={{ marginTop: '12px' }}>
                  {environmentsConfig.environments.map(env => (
                    <Badge key={env} style={{ margin: '4px' }}>
                      {env}
                    </Badge>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Destination Summary */}
            <Card style={{ marginBottom: '20px' }}>
              <CardBody>
                <Title headingLevel="h4" size="md">
                  Destination Configuration
                </Title>
                <div style={{ marginTop: '12px' }}>
                  <Text>
                    <strong>Destination:</strong> {getDestinationDisplayName()}
                  </Text>
                  <Text>
                    <strong>Runtime:</strong> {containerRuntime}
                  </Text>
                  {destination === 'push' && (
                    <>
                      <Text>
                        <strong>Registry:</strong> {getEffectiveRegistryUrl()}
                      </Text>
                      <Text>
                        <strong>Repository:</strong> {repository}
                      </Text>
                      <Text>
                        <strong>Tag:</strong> {tag}
                      </Text>
                    </>
                  )}
                </div>
              </CardBody>
            </Card>

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
              <Button variant="secondary" onClick={handlePrevious}>
                Back
              </Button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="link" onClick={handleClose}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleBuild}>
                  Start Build
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default BuildDestinationWizard;
