// frontend/src/components/exports/ExportManager.tsx

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
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
  AlertActionCloseButton
} from '@patternfly/react-core';
import {
  DownloadIcon,
  ExportIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CubesIcon
} from '@patternfly/react-icons';

// Types
interface BuiltImage {
  name: string;
  tag: string;
  image_id: string;
  created: string;
  size: string;
}

interface ExportResponse {
  export_id: string;
  status: string;
  image_name: string;
  message: string;
}

interface ExportStatus {
  export_id: string;
  status: string;
  image_name: string;
  start_time: string;
  end_time?: string;
  return_code?: number;
  logs: string[];
  file_path?: string;
  file_size?: number;
}

interface AlertMessage {
  variant: AlertVariant;
  title: string;
  message: string;
}

const ExportManager: React.FC = () => {
  const [images, setImages] = useState<BuiltImage[]>([]);
  const [selectedImage, setSelectedImage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exports, setExports] = useState<ExportStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertMessage | null>(null);
  const [containerRuntime, setContainerRuntime] = useState('podman');

  useEffect(() => {
    loadBuiltImages();
    const interval = setInterval(refreshExports, 3000);
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

  const startExport = async () => {
    if (!selectedImage) {
      setAlert({
        variant: AlertVariant.warning,
        title: 'Warning',
        message: 'Please select an image to export'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiCall('/api/builds/export', {
        method: 'POST',
        body: JSON.stringify({
          image_name: selectedImage,
          container_runtime: containerRuntime
        }),
      });

      setExports(prev => [response, ...prev]);
      setAlert({
        variant: AlertVariant.success,
        title: 'Export Started',
        message: `Started exporting ${selectedImage}`
      });
      setIsModalOpen(false);
      setSelectedImage('');
    } catch (error: any) {
      setAlert({
        variant: AlertVariant.danger,
        title: 'Export Failed',
        message: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshExports = async () => {
    const updatedExports = await Promise.all(
      exports.map(async (exportItem) => {
        try {
          const response = await apiCall(`/api/builds/export/${exportItem.export_id}/status`);
          return response;
        } catch (error) {
          console.error('Failed to refresh export status:', error);
          return exportItem;
        }
      })
    );
    setExports(updatedExports);
  };

  const downloadExport = async (exportId: string, imageName: string) => {
    try {
      const response = await fetch(`/api/builds/export/${exportId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeImageName = imageName.replace(/[/:\\]/g, '_');
        a.href = url;
        a.download = `${safeImageName}.tar`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setAlert({
          variant: AlertVariant.success,
          title: 'Download Started',
          message: `Download started for ${imageName}`
        });
      } else {
        throw new Error('Failed to download export');
      }
    } catch (error: any) {
      setAlert({
        variant: AlertVariant.danger,
        title: 'Download Failed',
        message: error.message
      });
    }
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

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <Card>
      <CardTitle>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem>
            <ExportIcon /> Export & Download EE Images
          </FlexItem>
          <FlexItem>
            <Button
              variant="primary"
              onClick={() => setIsModalOpen(true)}
              icon={<DownloadIcon />}
            >
              Export Image
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
          <Text component={TextVariants.h3}>Active Exports</Text>
        </TextContent>

        {exports.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon icon={CubesIcon} />
            <TextContent>
              <Text component={TextVariants.h2}>No exports in progress</Text>
            </TextContent>
            <EmptyStateBody>
              Click "Export Image" to start exporting an execution environment.
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <List>
            {exports.map((exportItem) => (
              <ListItem key={exportItem.export_id}>
                <Card>
                  <CardBody>
                    <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
                      <FlexItem>
                        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>{getStatusIcon(exportItem.status)}</FlexItem>
                          <FlexItem>
                            <Text component={TextVariants.h4}>{exportItem.image_name}</Text>
                          </FlexItem>
                          <FlexItem>
                            <Label variant="outline" color={getStatusColor(exportItem.status)}>
                              {exportItem.status}
                            </Label>
                          </FlexItem>
                        </Flex>
                      </FlexItem>
                      
                      {exportItem.status === 'running' && (
                        <FlexItem>
                          <Progress
                            title="Exporting..."
                            measureLocation={ProgressMeasureLocation.none}
                          />
                        </FlexItem>
                      )}
                      
                      {exportItem.file_size && (
                        <FlexItem>
                          <Text component={TextVariants.small}>
                            File size: {formatFileSize(exportItem.file_size)}
                          </Text>
                        </FlexItem>
                      )}
                      
                      {exportItem.status === 'completed' && (
                        <FlexItem>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<DownloadIcon />}
                            onClick={() => downloadExport(exportItem.export_id, exportItem.image_name)}
                          >
                            Download .tar file
                          </Button>
                        </FlexItem>
                      )}
                      
                      <FlexItem>
                        <Text component={TextVariants.small}>
                          Started: {new Date(exportItem.start_time).toLocaleString()}
                        </Text>
                      </FlexItem>
                    </Flex>
                  </CardBody>
                </Card>
              </ListItem>
            ))}
          </List>
        )}

        {/* Export Modal */}
        <Modal
          variant={ModalVariant.medium}
          title="Export Execution Environment"
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          actions={[
            <Button
              key="export"
              variant="primary"
              onClick={startExport}
              isLoading={isLoading}
              isDisabled={!selectedImage || isLoading}
            >
              Start Export
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
            
            <FormGroup label="Select Image to Export" fieldId="image-select" isRequired>
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
            
            <TextContent>
              <Text component={TextVariants.small}>
                The selected image will be exported as a .tar file that can be imported on other systems.
              </Text>
            </TextContent>
          </Form>
        </Modal>
      </CardBody>
    </Card>
  );
};

export default ExportManager;
