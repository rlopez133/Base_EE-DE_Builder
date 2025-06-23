// frontend/src/components/builds/BuildDestinationSelector.tsx

import React, { useState } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Button,
  Alert,
  Flex,
  FlexItem,
  Text,
  Label,
  ExpandableSection,
  Grid,
  GridItem,
  Radio,
  Split,
  SplitItem
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  CloudIcon,
  DownloadIcon,
  CubesIcon
} from '@patternfly/react-icons';

import { 
  BUILD_DESTINATIONS, 
  BuildDestination, 
  BuildDestinationConfig,
  ExportConfig,
  PushConfig
} from '../../types/BuildDestination';

interface BuildDestinationSelectorProps {
  value: BuildDestinationConfig;
  onChange: (config: BuildDestinationConfig) => void;
  rhAuthStatus?: string;
  onOpenRHAuthModal?: () => void;
  showAdvanced?: boolean;
  disabled?: boolean;
}

const BuildDestinationSelector: React.FC<BuildDestinationSelectorProps> = ({
  value,
  onChange,
  rhAuthStatus,
  onOpenRHAuthModal,
  showAdvanced = false,
  disabled = false
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleDestinationChange = (destinationType: BuildDestination['type']) => {
    const newConfig: BuildDestinationConfig = {
      destination: destinationType,
      export: destinationType === 'export' || destinationType === 'export_and_push' 
        ? { enabled: true, containerRuntime: 'podman' }
        : { enabled: false },
      push: destinationType === 'push' || destinationType === 'export_and_push'
        ? { 
            enabled: true, 
            registryUrl: 'quay.io',
            repository: '',
            tag: 'latest',
            containerRuntime: 'podman'
          }
        : { enabled: false }
    };
    onChange(newConfig);
    setValidationResult(null);
  };

  const handleExportConfigChange = (field: keyof ExportConfig, value: any) => {
    onChange({
      ...value,
      export: {
        ...value.export,
        [field]: value
      }
    });
  };

  const handlePushConfigChange = (field: keyof PushConfig, newValue: any) => {
    const updatedPush = {
      ...value.push,
      enabled: value.push?.enabled || false,
      [field]: newValue
    };
    
    onChange({
      ...value,
      push: updatedPush
    });
    setValidationResult(null);
  };

  const handleCredentialsChange = (field: 'username' | 'password', newValue: string) => {
    const updatedCredentials = {
      username: value.push?.credentials?.username || '',
      password: value.push?.credentials?.password || '',
      [field]: newValue
    };
    
    onChange({
      ...value,
      push: {
        ...value.push,
        enabled: value.push?.enabled || false,
        credentials: updatedCredentials
      }
    });
    setValidationResult(null);
  };

  const validatePushConfig = async () => {
    if (!value.push?.enabled || !value.push?.registryUrl || !value.push?.repository || 
        !value.push?.credentials?.username || !value.push?.credentials?.password) {
      setValidationResult({
        success: false,
        message: 'Please fill in all required registry fields'
      });
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch('/api/builds/validate-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registry_url: value.push.registryUrl,
          repository: value.push.repository,
          tag: value.push.tag,
          credentials: value.push.credentials,
          container_runtime: value.push.containerRuntime || 'podman'
        })
      });

      if (response.ok) {
        setValidationResult({
          success: true,
          message: 'Registry credentials validated successfully!'
        });
      } else {
        const error = await response.json();
        setValidationResult({
          success: false,
          message: error.detail || 'Validation failed'
        });
      }
    } catch (error: any) {
      setValidationResult({
        success: false,
        message: `Validation error: ${error.message}`
      });
    } finally {
      setIsValidating(false);
    }
  };

  const getDestinationIcon = (type: BuildDestination['type']) => {
    switch (type) {
      case 'local': return <CubesIcon />;
      case 'export': return <DownloadIcon />;
      case 'push': return <CloudIcon />;
      case 'export_and_push': return <><DownloadIcon style={{ marginRight: '4px' }} /><CloudIcon /></>;
      default: return <CubesIcon />;
    }
  };

  const needsRHAuth = value.push?.enabled && value.push?.registryUrl?.includes('registry.redhat.io');

  return (
    <Card>
      <CardTitle>Build Destinations</CardTitle>
      <CardBody>
        {/* Destination Selection */}
        <FormGroup label="Choose build destinations" fieldId="destination-select" isRequired>
          <div style={{ display: 'grid', gap: '12px' }}>
            {BUILD_DESTINATIONS.map((destination) => (
              <div
                key={destination.type}
                style={{
                  padding: '16px',
                  border: value.destination === destination.type ? '2px solid #0066cc' : '1px solid #d2d2d2',
                  borderRadius: '8px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  backgroundColor: value.destination === destination.type ? '#f0f8ff' : 'white',
                  opacity: disabled ? 0.6 : 1
                }}
                onClick={() => !disabled && handleDestinationChange(destination.type)}
              >
                <Flex alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Radio
                      id={`destination-${destination.type}`}
                      name="destination"
                      isChecked={value.destination === destination.type}
                      onChange={() => !disabled && handleDestinationChange(destination.type)}
                      isDisabled={disabled}
                    />
                  </FlexItem>
                  <FlexItem style={{ marginLeft: '12px' }}>
                    {getDestinationIcon(destination.type)}
                  </FlexItem>
                  <FlexItem style={{ marginLeft: '8px' }}>
                    <div>
                      <Text style={{ fontWeight: 'bold' }}>{destination.label}</Text>
                      <Text component="small" style={{ color: '#6a6e73', display: 'block', marginTop: '4px' }}>
                        {destination.description}
                      </Text>
                    </div>
                  </FlexItem>
                </Flex>
              </div>
            ))}
          </div>
        </FormGroup>

        {/* Export Configuration */}
        {value.export?.enabled && (
          <ExpandableSection toggleText="Export Configuration" isExpanded>
            <FormGroup label="Container Runtime" fieldId="export-runtime">
              <FormSelect
                value={value.export.containerRuntime || 'podman'}
                onChange={(_, runtime) => handleExportConfigChange('containerRuntime', runtime)}
                isDisabled={disabled}
              >
                <FormSelectOption value="podman" label="Podman" />
                <FormSelectOption value="docker" label="Docker" />
              </FormSelect>
            </FormGroup>
            <Text component="small" style={{ color: '#6a6e73' }}>
              Images will be exported as .tar files for download after the build completes.
            </Text>
          </ExpandableSection>
        )}

        {/* Push Configuration */}
        {value.push?.enabled && (
          <ExpandableSection toggleText="Registry Push Configuration" isExpanded>
            <Grid hasGutter>
              <GridItem span={6}>
                <FormGroup label="Registry URL" fieldId="registry-url" isRequired>
                  <TextInput
                    id="registry-url"
                    value={value.push.registryUrl || ''}
                    onChange={(_, url) => handlePushConfigChange('registryUrl', url)}
                    placeholder="quay.io"
                    isDisabled={disabled}
                  />
                </FormGroup>
              </GridItem>
              <GridItem span={6}>
                <FormGroup label="Repository" fieldId="repository" isRequired>
                  <TextInput
                    id="repository"
                    value={value.push.repository || ''}
                    onChange={(_, repo) => handlePushConfigChange('repository', repo)}
                    placeholder="username/repository-name"
                    isDisabled={disabled}
                  />
                </FormGroup>
              </GridItem>
              <GridItem span={6}>
                <FormGroup label="Tag" fieldId="tag">
                  <TextInput
                    id="tag"
                    value={value.push.tag || 'latest'}
                    onChange={(_, tag) => handlePushConfigChange('tag', tag)}
                    placeholder="latest"
                    isDisabled={disabled}
                  />
                </FormGroup>
              </GridItem>
              <GridItem span={6}>
                <FormGroup label="Container Runtime" fieldId="push-runtime">
                  <FormSelect
                    value={value.push.containerRuntime || 'podman'}
                    onChange={(_, runtime) => handlePushConfigChange('containerRuntime', runtime)}
                    isDisabled={disabled}
                  >
                    <FormSelectOption value="podman" label="Podman" />
                    <FormSelectOption value="docker" label="Docker" />
                  </FormSelect>
                </FormGroup>
              </GridItem>
              <GridItem span={6}>
                <FormGroup label="Username" fieldId="username" isRequired>
                  <TextInput
                    id="username"
                    value={value.push.credentials?.username || ''}
                    onChange={(_, username) => handleCredentialsChange('username', username)}
                    placeholder="Your registry username"
                    isDisabled={disabled}
                  />
                </FormGroup>
              </GridItem>
              <GridItem span={6}>
                <FormGroup label="Password/Token" fieldId="password" isRequired>
                  <Flex>
                    <FlexItem flex={{ default: 'flex_1' }}>
                      <TextInput
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={value.push.credentials?.password || ''}
                        onChange={(_, password) => handleCredentialsChange('password', password)}
                        placeholder="Your registry password or API token"
                        isDisabled={disabled}
                      />
                    </FlexItem>
                    <FlexItem>
                      <Button
                        variant="control"
                        onClick={() => setShowPassword(!showPassword)}
                        icon={showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        isDisabled={disabled}
                      />
                    </FlexItem>
                  </Flex>
                </FormGroup>
              </GridItem>
            </Grid>

            {/* Registry Target Preview */}
            {value.push.registryUrl && value.push.repository && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
                <Text component="small">
                  <strong>Target:</strong> {value.push.registryUrl}/{value.push.repository}:{value.push.tag || 'latest'}
                </Text>
              </div>
            )}

            {/* Red Hat Registry Warning */}
            {needsRHAuth && rhAuthStatus !== 'authenticated' && (
              <Alert 
                variant="warning" 
                title="Red Hat Registry Authentication Required" 
                isInline 
                style={{ marginTop: '12px' }}
              >
                This registry requires Red Hat authentication. 
                {onOpenRHAuthModal && (
                  <Button 
                    variant="link" 
                    isInline 
                    onClick={onOpenRHAuthModal}
                    style={{ marginLeft: '8px', padding: '0' }}
                  >
                    Login now
                  </Button>
                )}
              </Alert>
            )}

            {/* Validation */}
            <div style={{ marginTop: '16px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={validatePushConfig}
                isLoading={isValidating}
                isDisabled={disabled || isValidating}
              >
                Validate Registry Credentials
              </Button>
            </div>

            {validationResult && (
              <Alert
                variant={validationResult.success ? "success" : "danger"}
                title={validationResult.success ? "Validation Successful" : "Validation Failed"}
                isInline
                style={{ marginTop: '12px' }}
              >
                {validationResult.message}
              </Alert>
            )}
          </ExpandableSection>
        )}

        {/* Configuration Summary */}
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <Text style={{ fontWeight: 'bold', marginBottom: '8px' }}>Selected Configuration:</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <Label color="blue">
              {BUILD_DESTINATIONS.find(d => d.type === value.destination)?.label || 'Local Only'}
            </Label>
            {value.export?.enabled && <Label color="green">Export .tar</Label>}
            {value.push?.enabled && <Label color="purple">Push to Registry</Label>}
            {needsRHAuth && (
              <Label color={rhAuthStatus === 'authenticated' ? 'green' : 'orange'}>
                {rhAuthStatus === 'authenticated' ? '✓ RH Auth' : '⚠ RH Auth Required'}
              </Label>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default BuildDestinationSelector;
