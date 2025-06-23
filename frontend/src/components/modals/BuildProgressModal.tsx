import React, { useEffect, useState } from 'react';
import {
  Modal,
  ModalVariant,
  Button,
  Alert,
  Card,
  CardTitle,
  CardBody,
  Text,
  Grid,
  GridItem,
  Progress,
  ProgressSize,
  Spinner,
  ExpandableSection,
  TextArea,
  Flex,
  FlexItem,
  List,
  ListItem,
  Label,
  Tabs,
  Tab,
  TabTitleText
} from '@patternfly/react-core';

import {
  StopIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DownloadIcon,
  ExternalLinkAltIcon,
  SpinnerIcon
} from '@patternfly/react-icons';

import { PostBuildOperation } from '../../types/BuildDestination';

// Import your existing Build type
import { Build } from '../../types'; // Adjust path as needed

interface BuildProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  building: boolean;
  currentBuild: Build | null;
  buildDebugInfo: string | null;
  selectedEnvs: string[];
  onCancelBuild: () => void;
  getProgressValue: () => number;
  getBuildStatusIcon: (status: string) => React.ReactNode;
}

const BuildProgressModal: React.FC<BuildProgressModalProps> = ({
  isOpen,
  onClose,
  building,
  currentBuild,
  buildDebugInfo,
  selectedEnvs,
  onCancelBuild,
  getProgressValue,
  getBuildStatusIcon
}) => {
  const [activeTab, setActiveTab] = useState<string | number>('build');

  // Switch to post-build operations tab when build completes and operations exist
  useEffect(() => {
    if (currentBuild?.status === 'completed' && 
        (currentBuild as any)?.post_build_operations && 
        (currentBuild as any).post_build_operations.length > 0) {
      setActiveTab('operations');
    }
  }, [currentBuild?.status, (currentBuild as any)?.post_build_operations]);

  const getOperationIcon = (operation: PostBuildOperation) => {
    switch (operation.status) {
      case 'completed':
        return <CheckCircleIcon style={{ color: '#3e8635' }} />;
      case 'failed':
        return <ExclamationCircleIcon style={{ color: '#c9190b' }} />;
      case 'running':
        return <SpinnerIcon className="pf-c-spinner" />;
      default:
        return <SpinnerIcon className="pf-c-spinner" />;
    }
  };

  const getOperationColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'failed': return 'red';
      case 'running': return 'blue';
      default: return 'grey';
    }
  };

  const downloadExport = async (operationId: string, imageName: string) => {
    try {
      const response = await fetch(`/api/builds/export/${operationId}/download`);
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
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const renderPostBuildOperations = () => {
    const postBuildOps = (currentBuild as any)?.post_build_operations as PostBuildOperation[] | undefined;
    
    if (!postBuildOps || postBuildOps.length === 0) {
      return (
        <Alert variant="info" title="No Post-Build Operations" isInline>
          This build was configured for local-only storage.
        </Alert>
      );
    }

    return (
      <div>
        <Text style={{ marginBottom: '16px' }}>
          Post-build operations are running automatically based on your build configuration.
        </Text>
        
        <List>
          {postBuildOps.map((operation, index) => (
            <ListItem key={`${operation.type}-${index}`}>
              <Card>
                <CardBody>
                  <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
                    <FlexItem>
                      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                        <FlexItem>{getOperationIcon(operation)}</FlexItem>
                        <FlexItem>
                          <Text style={{ fontWeight: 'bold' }}>
                            {operation.type === 'export' ? 'Export to .tar file' : 'Push to Registry'}
                          </Text>
                        </FlexItem>
                        <FlexItem>
                          <Label color={getOperationColor(operation.status)}>
                            {operation.status}
                          </Label>
                        </FlexItem>
                      </Flex>
                    </FlexItem>
                    
                    <FlexItem>
                      <Text component="small">
                        <strong>Image:</strong> {operation.image_name}
                      </Text>
                      {operation.target_url && (
                        <Text component="small" style={{ display: 'block' }}>
                          <strong>Target:</strong> {operation.target_url}
                        </Text>
                      )}
                    </FlexItem>

                    {operation.status === 'running' && (
                      <FlexItem>
                        <Progress
                          title={`${operation.type === 'export' ? 'Exporting' : 'Pushing'}...`}
                          measureLocation="none"
                        />
                      </FlexItem>
                    )}

                    {operation.status === 'failed' && operation.error_message && (
                      <FlexItem>
                        <Alert variant="danger" title="Operation Failed" isInline>
                          {operation.error_message}
                        </Alert>
                      </FlexItem>
                    )}

                    {operation.status === 'completed' && (
                      <FlexItem>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                          {operation.type === 'export' && operation.operation_id && (
                            <FlexItem>
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<DownloadIcon />}
                                onClick={() => downloadExport(operation.operation_id!, operation.image_name)}
                              >
                                Download .tar file
                              </Button>
                            </FlexItem>
                          )}
                          {operation.type === 'push' && operation.target_url && (
                            <FlexItem>
                              <Button
                                variant="link"
                                size="sm"
                                icon={<ExternalLinkAltIcon />}
                                component="a"
                                href={`https://${operation.target_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View on Registry
                              </Button>
                            </FlexItem>
                          )}
                        </Flex>
                      </FlexItem>
                    )}

                    {operation.start_time && (
                      <FlexItem>
                        <Text component="small" style={{ color: '#6a6e73' }}>
                          Started: {new Date(operation.start_time).toLocaleString()}
                          {operation.end_time && (
                            <> • Completed: {new Date(operation.end_time).toLocaleString()}</>
                          )}
                        </Text>
                      </FlexItem>
                    )}
                  </Flex>
                </CardBody>
              </Card>
            </ListItem>
          ))}
        </List>
      </div>
    );
  };

  const getOverallProgress = () => {
    const postBuildOps = (currentBuild as any)?.post_build_operations as PostBuildOperation[] | undefined;
    
    if (!postBuildOps || postBuildOps.length === 0) {
      return getProgressValue();
    }

    // If build is complete, calculate progress based on post-build operations
    if (currentBuild?.status === 'completed') {
      const totalOps = postBuildOps.length;
      const completedOps = postBuildOps.filter(op => 
        op.status === 'completed' || op.status === 'failed'
      ).length;
      
      return Math.round(((completedOps / totalOps) * 100));
    }

    return getProgressValue();
  };

  const isAllComplete = () => {
    if (currentBuild?.status !== 'completed') return false;
    
    const postBuildOps = (currentBuild as any)?.post_build_operations as PostBuildOperation[] | undefined;
    
    if (!postBuildOps || postBuildOps.length === 0) {
      return true;
    }

    return postBuildOps.every(op => 
      op.status === 'completed' || op.status === 'failed'
    );
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title={
        <Flex alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>{currentBuild && getBuildStatusIcon(currentBuild.status)}</FlexItem>
          <FlexItem>
            Build Progress {currentBuild && (currentBuild.id || (currentBuild as any).build_id) !== 'initializing' && `(${currentBuild.id || (currentBuild as any).build_id})`}
          </FlexItem>
        </Flex>
      }
      isOpen={isOpen}
      onClose={onClose}
      actions={[
        ...(building && currentBuild?.status === 'running' ? [
          <Button key="cancel" variant="secondary" onClick={onCancelBuild} icon={<StopIcon />}>
            Cancel Build
          </Button>
        ] : []),
        <Button key="close" variant="primary" onClick={onClose}>
          Close
        </Button>
      ]}
    >
      <div style={{ minHeight: '500px' }}>
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
                    <Text><strong>Started:</strong> {new Date(currentBuild.started_at || (currentBuild as any).start_time).toLocaleTimeString()}</Text>
                    {(currentBuild as any).build_time_seconds && (
                      <Text><strong>Duration:</strong> {(currentBuild as any).build_time_seconds}s</Text>
                    )}
                  </>
                )}
              </GridItem>
            </Grid>
          </CardBody>
        </Card>

        {/* Overall Progress Bar */}
        <Progress
          value={getOverallProgress()}
          title={isAllComplete() ? "All Operations Complete" : 
                 currentBuild?.status === 'completed' ? "Post-Build Operations" : "Build Progress"}
          size={ProgressSize.lg}
          style={{ marginBottom: '1rem' }}
        />

        {/* Status Alert */}
        {currentBuild && (
          <Alert
            variant={currentBuild.status === 'completed' && isAllComplete() ? 'success' : 
                    currentBuild.status === 'failed' ? 'danger' : 
                    currentBuild.status === 'lost' ? 'warning' : 'info'}
            title={isAllComplete() ? "All operations completed successfully" : 
                   `Build ${currentBuild.status}`}
            isInline
            style={{ marginBottom: '1rem' }}
          >
            {currentBuild.status === 'completed' && isAllComplete() && 
              `Successfully built and processed ${(currentBuild as any).successful_builds?.length || selectedEnvs.length} environments`}
            {currentBuild.status === 'completed' && !isAllComplete() && 
              'Build completed, post-build operations in progress'}
            {currentBuild.status === 'failed' && 
              'Build failed - check logs below for details'}
            {currentBuild.status === 'lost' && 
              'Build connection lost due to server restart - process may have continued'}
            {(currentBuild.status === 'running' || currentBuild.status === 'starting') && 
              'Build in progress - real-time logs below'}
          </Alert>
        )}

        {/* Tabbed Content */}
        <Tabs 
          activeKey={activeTab} 
          onSelect={(_, tabIndex) => setActiveTab(tabIndex)}
          style={{ marginBottom: '1rem' }}
        >
          <Tab eventKey={'build'} title={<TabTitleText>Build Logs</TabTitleText>}>
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
          </Tab>

          <Tab 
            eventKey={'operations'} 
            title={
              <TabTitleText>
                Post-Build Operations
                {(() => {
                  const postBuildOps = (currentBuild as any)?.post_build_operations as PostBuildOperation[] | undefined;
                  return postBuildOps && postBuildOps.length > 0 && (
                    <span style={{ marginLeft: '8px' }}>
                      ({postBuildOps.filter(op => op.status === 'completed').length}/
                      {postBuildOps.length})
                    </span>
                  );
                })()}
              </TabTitleText>
            }
          >
            {renderPostBuildOperations()}
          </Tab>

          {buildDebugInfo ? (
            <Tab eventKey={'debug'} title={<TabTitleText>Debug Info</TabTitleText>}>
              <ExpandableSection toggleText="Debug Info (for troubleshooting)">
                <TextArea
                  value={buildDebugInfo}
                  rows={10}
                  readOnly
                  style={{ fontFamily: 'monospace', fontSize: '11px' }}
                />
              </ExpandableSection>
            </Tab>
          ) : null}
        </Tabs>
      </div>
    </Modal>
  );
};

export default BuildProgressModal;
