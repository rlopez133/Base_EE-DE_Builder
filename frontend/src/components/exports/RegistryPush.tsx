// frontend/src/components/exports/RegistryPush.tsx

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Modal,
  ModalVariant,
  Alert,
  AlertVariant,
  Progress,
  ProgressMeasureLocation,
  TextContent,
  Text,
  TextVariants,
  List,
  ListItem,
  Spinner,
  Flex,
  FlexItem,
  Label,
  ExpandableSection,
  Split,
  SplitItem,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  AlertActionCloseButton
} from '@patternfly/react-core';
import {
  CloudUploadAltIcon,
  ExternalLinkAltIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  RegistryIcon
} from '@patternfly/react-icons';

// Types
interface BuiltImage {
  name: string;
  tag: string;
  image_id: string;
  created: string;
  size: string;
}

interface PushResponse {
  push_id: string;
  status: string;
  image_name: string;
  target_url: string;
  message: string;
}

interface PushStatus {
  push_id: string;
  status: string;
  image_name: string;
  target_url: string;
  start_time: string;
  end_time?: string;
  return_code?: number;
  logs: string[];
}

interface AlertMessage {
  variant: AlertVariant;
  title: string;
  message: string;
}

const RegistryPush: React.FC = () => {
  const [images, setImages] = useState<BuiltImage[]>([]);
  const [selectedImage, setSelectedImage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pushes, setPushes] = useState<PushStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertMessage | null>(null);
  const [containerRuntime, setContainerRuntime] = useState('podman');
  
  // Form fields
  const [registryUrl, setRegistryUrl] = useState('quay.io');
  const [repository, setRepository] = useState('');
  const [tag, setTag] = useState('latest');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    loadBuiltImages();
    const interval = setInterval(refreshPushes, 3000);
    return () => clearInterval(interval);
  }, []);

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
        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`API call failed for ${url}:`, error);
      throw error;
    }
  };

  const loadBuiltImages = async () => {
    try {
      const data = await apiCall(`/api/builds/images?container_runtime=${containerRuntime}`);
      setImages(data.images);
    } catch (error: any) {
      setAlert({
        variant: AlertVariant.danger,
        title: 'Error',
        message: `Failed to load built images: ${error.message}`
      });
    }
  };

  const validateCredentials = async () => {
    if (!username || !password || !registryUrl || !repository) {
      setAlert({
        variant: AlertVariant.warning,
        title: 'Validation Error',
        message: 'Please fill in all required fields before validating'
      });
      return;
    }

    setIsValidating(true);
    try {
      await apiCall('/api/builds/validate-registry', {
        method: 'POST',
        body: JSON.stringify({
          image_name: selectedImage,
          registry_url: registryUrl,
          repository: repository,
          tag: tag,
          credentials: {
            username: username,
            password: password
          },
          container_runtime: containerRuntime
        }),
      });

      setAlert({
        variant: AlertVariant.success,
        title: 'Validation Successful',
        message: 'Registry credentials are valid!'
      });
    } catch (error: any) {
      setAlert({
        variant: AlertVariant.danger,
        title: 'Validation Failed',
        message: error.message
      });
    } finally {
      setIsValidating(false);
    }
  };

  const startPush = async () => {
    if (!selectedImage || !registryUrl || !repository || !username || !password) {
      setAlert({
        variant: AlertVariant.warning,
        title: 'Missing Information',
        message: 'Please fill in all required fields'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiCall('/api/builds/push', {
        method: 'POST',
        body: JSON.stringify({
          image_name: selectedImage,
          registry_url: registryUrl,
          repository: repository,
          tag: tag,
          credentials: {
            username: username,
            password: password
          },
          container_runtime: containerRuntime
        }),
      });

      setPushes(prev => [response, ...prev]);
      setAlert({
        variant: AlertVariant.success,
        title: 'Push Started',
        message: `Started pushing ${selectedImage} to ${response.target_url}`
      });
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      setAlert({
        variant: AlertVariant.danger,
        title: 'Push Failed',
        message: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedImage('');
    setRepository('');
    setTag('latest');
    setUsername('');
    setPassword('');
  };

  const refreshPushes = async () => {
    const updatedPushes = await Promise.all(
      pushes.map(async (pushItem) => {
        try {
          const response = await apiCall(`/api/builds/push/${pushItem.push_id}/status`);
          return response;
        } catch (error) {
          console.error('Failed to refresh push status:', error);
          return pushItem;
        }
      })
    );
    setPushes(updatedPushes);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon style={{ color: '#3e8635' }} />;
      case 'failed':
        return <ExclamationCircleIcon style={{ color: '#c9190b' }} />;
      case 'running':
        return <Spinner size="sm" />;
      default:
        return <Spinner size="sm" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      case 'running':
        return 'blue';
      default:
        return 'grey';
    }
  };

  return (
    <Card>
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem>
            <CloudUploadAltIcon /> Push to Quay.io Registry
          </FlexItem>
          <FlexItem>
            <Button
              variant="primary"
              onClick={() => setIsModalOpen(true)}
              icon={<CloudUploadAltIcon />}
            >
              Push to Registry
            </Button>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        {alert && (
          <Alert
            variant={alert.variant}
            title={alert.title}
            actionClose={<AlertActionCloseButton onClose={() => setAlert(null)} />}
            style={{ marginBottom: '1rem' }}
          >
            {alert.message}
          </Alert>
        )}

        <TextContent>
          <Text component={TextVariants.h3}>Active Pushes</Text>
        </TextContent>

        {pushes.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={RegistryIcon} />
            <TextContent>
              <Text component={TextVariants.h2}>No registry pushes in progress</Text>
            </TextContent>
            <EmptyStateBody>
              Click "Push to Registry" to start pushing an execution environment to a container registry.
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <List>
            {pushes.map((pushItem) => (
              <ListItem key={pushItem.push_id}>
                <Card>
                  <CardBody>
                    <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
                      <FlexItem>
                        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>{getStatusIcon(pushItem.status)}</FlexItem>
                          <FlexItem>
                            <Text component={TextVariants.h4}>{pushItem.image_name}</Text>
                          </FlexItem>
                          <FlexItem>
                            <Label variant="outline" color={getStatusColor(pushItem.status)}>
                              {pushItem.status}
                            </Label>
                          </FlexItem>
                        </Flex>
                      </FlexItem>
                      
                      <FlexItem>
                        <Split hasGutter>
                          <SplitItem>
                            <Text component={TextVariants.small}>
                              Target: {pushItem.target_url}
                            </Text>
                          </SplitItem>
                          {pushItem.status === 'completed' && (
                            <SplitItem>
                              <Button
                                variant="link"
                                isInline
                                icon={<ExternalLinkAltIcon />}
                                component="a"
                                href={`https://${pushItem.target_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View on Registry
                              </Button>
                            </SplitItem>
                          )}
                        </Split>
                      </FlexItem>
                      
                      {pushItem.status === 'running' && (
                        <FlexItem>
                          <Progress
                            title="Pushing to registry..."
                            measureLocation={ProgressMeasureLocation.none}
                          />
                        </FlexItem>
                      )}
                      
                      <FlexItem>
                        <Text component={TextVariants.small}>
                          Started: {new Date(pushItem.start_time).toLocaleString()}
                        </Text>
                      </FlexItem>

                      {pushItem.logs && pushItem.logs.length > 0 && (
                        <FlexItem>
                          <ExpandableSection
                            toggleText={`View logs (${pushItem.logs.length} entries)`}
                            isIndented
                          >
                            <div style={{ 
                              maxHeight: '200px', 
                              overflow: 'auto', 
                              backgroundColor: '#f5f5f5', 
                              padding: '1rem', 
                              borderRadius: '4px',
                              fontFamily: 'monospace',
                              fontSize: '0.875rem'
                            }}>
                              {pushItem.logs.map((log, index) => (
                                <div key={index} style={{ marginBottom: '0.25rem' }}>
                                  {log}
                                </div>
                              ))}
                            </div>
                          </ExpandableSection>
                        </FlexItem>
                      )}
                    </Flex>
                  </CardBody>
                </Card>
              </ListItem>
            ))}
          </List>
        )}

        {/* Push Modal */}
        <Modal
          variant={ModalVariant.medium}
          title="Push to Container Registry"
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          actions={[
            <Button
              key="validate"
              variant="secondary"
              onClick={validateCredentials}
              isLoading={isValidating}
              isDisabled={isValidating || isLoading}
            >
              Validate Credentials
            </Button>,
            <Button
              key="push"
              variant="primary"
              onClick={startPush}
              isLoading={isLoading}
              isDisabled={!selectedImage || !registryUrl || !repository || !username || !password || isLoading}
            >
              Start Push
            </Button>,
            <Button
              key="cancel"
              variant="link"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
          ]}
        >
          <Form>
            <FormGroup label="Container Runtime" fieldId="container-runtime">
              <FormSelect
                value={containerRuntime}
                onChange={(_event, value) => setContainerRuntime(value)}
                id="container-runtime"
              >
                <FormSelectOption value="podman" label="Podman" />
                <FormSelectOption value="docker" label="Docker" />
              </FormSelect>
            </FormGroup>
            
            <FormGroup label="Select Image to Push" fieldId="image-select" isRequired>
              <FormSelect
                value={selectedImage}
                onChange={(_event, value) => setSelectedImage(value)}
                id="image-select"
                placeholder="Choose an image..."
              >
                <FormSelectOption value="" label="Select an image" isDisabled />
                {images.map((image) => (
                  <FormSelectOption
                    key={image.name}
                    value={image.name}
                    label={`${image.name} (${image.size})`}
                  />
                ))}
              </FormSelect>
            </FormGroup>

            <FormGroup label="Registry URL" fieldId="registry-url" isRequired>
              <TextInput
                id="registry-url"
                value={registryUrl}
                onChange={(_event, value) => setRegistryUrl(value)}
                placeholder="quay.io"
              />
            </FormGroup>

            <FormGroup label="Repository" fieldId="repository" isRequired>
              <TextInput
                id="repository"
                value={repository}
                onChange={(_event, value) => setRepository(value)}
                placeholder="username/repository-name"
              />
            </FormGroup>

            <FormGroup label="Tag" fieldId="tag">
              <TextInput
                id="tag"
                value={tag}
                onChange={(_event, value) => setTag(value)}
                placeholder="latest"
              />
            </FormGroup>

            <FormGroup label="Username" fieldId="username" isRequired>
              <TextInput
                id="username"
                value={username}
                onChange={(_event, value) => setUsername(value)}
                placeholder="Your registry username"
              />
            </FormGroup>

            <FormGroup label="Password/Token" fieldId="password" isRequired>
              <TextInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(_event, value) => setPassword(value)}
                placeholder="Your registry password or API token"
              />
              <Button
                variant="control"
                onClick={() => setShowPassword(!showPassword)}
                icon={showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                style={{ marginTop: '0.5rem' }}
              >
                {showPassword ? 'Hide' : 'Show'} Password
              </Button>
            </FormGroup>
            
            <TextContent>
              <Text component={TextVariants.small}>
                The image will be pushed to: <strong>{registryUrl}/{repository}:{tag}</strong>
              </Text>
              <Text component={TextVariants.small}>
                💡 For Quay.io, you can use your username/password or create an API token in your account settings.
              </Text>
            </TextContent>
          </Form>
        </Modal>
      </CardBody>
    </Card>
  );
};

export default RegistryPush;
