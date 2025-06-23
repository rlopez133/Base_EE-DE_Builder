import React, { useState } from 'react';
import {
  Card,
  CardTitle,
  CardBody,
  Button,
  Text,
  Label,
  Divider
} from '@patternfly/react-core';

import {
  PlayIcon,
  CheckCircleIcon,
  KeyIcon
} from '@patternfly/react-icons';

import BuildDestinationWizard from './BuildDestinationWizard';
import { EnhancedBuildRequest } from '../../types/BuildDestination';

interface BuildControlProps {
  selectedEnvs: string[];
  rhAuthStatus: string;
  rhUsername: string;
  connectionStatus: 'connected' | 'disconnected' | 'checking';
  building: boolean;
  environmentsCount: number;
  onStartBuild: (buildRequest: EnhancedBuildRequest) => void;
  onLogoutFromRH: () => void;
  onOpenRHAuthModal: () => void;
  getConnectionStatusIcon: () => React.ReactNode;
}

const BuildControl: React.FC<BuildControlProps> = ({
  selectedEnvs,
  rhAuthStatus,
  rhUsername,
  connectionStatus,
  building,
  environmentsCount,
  onStartBuild,
  onLogoutFromRH,
  onOpenRHAuthModal,
  getConnectionStatusIcon
}) => {
  const [isBuildWizardOpen, setIsBuildWizardOpen] = useState(false);

  const handleOpenBuildWizard = () => {
    setIsBuildWizardOpen(true);
  };

  const handleCompleteBuild = (buildRequest: EnhancedBuildRequest) => {
    onStartBuild(buildRequest);
    setIsBuildWizardOpen(false);
  };

  return (
    <>
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
                    onClick={onLogoutFromRH}
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
                    onClick={onOpenRHAuthModal}
                    style={{ marginLeft: '8px', padding: '0' }}
                    isDisabled={connectionStatus !== 'connected'}
                  >
                    Login
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Single Start Build Button */}
          <div style={{ marginBottom: '16px' }}>
            <Button
              variant="primary"
              icon={<PlayIcon />}
              onClick={handleOpenBuildWizard}
              isDisabled={selectedEnvs.length === 0 || building || connectionStatus !== 'connected'}
              isLoading={building}
              style={{ width: '100%' }}
            >
              {building ? 'Building...' : 'Start Build'}
            </Button>
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ padding: '12px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
            <Text component="small">
              <strong>Connection:</strong> {getConnectionStatusIcon()} {connectionStatus}<br />
              <strong>Backend:</strong> localhost:8000<br />
              <strong>Environments:</strong> {environmentsCount} found<br />
              <strong>Build System:</strong> ansible-builder<br />
              <strong>RH Registry:</strong> {rhAuthStatus === 'authenticated' ? `✅ ${rhUsername}` : '❌ Not authenticated'}
            </Text>
          </div>
        </CardBody>
      </Card>

      {/* New Build Destination Wizard */}
      <BuildDestinationWizard
        isOpen={isBuildWizardOpen}
        onClose={() => setIsBuildWizardOpen(false)}
        selectedEnvironments={selectedEnvs}
        onComplete={handleCompleteBuild}
        onCancel={() => setIsBuildWizardOpen(false)}
        rhAuthStatus={rhAuthStatus}
        onOpenRHAuthModal={onOpenRHAuthModal}
      />
    </>
  );
};

export default BuildControl;
