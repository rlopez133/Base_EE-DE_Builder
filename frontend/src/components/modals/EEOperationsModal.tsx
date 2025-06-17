// frontend/src/components/modals/EEOperationsModal.tsx

import React, { useState } from 'react';
import {
  Modal,
  ModalVariant,
  Tabs,
  Tab,
  TabTitleText
} from '@patternfly/react-core';
import {
  DownloadIcon,
  CloudUploadAltIcon
} from '@patternfly/react-icons';

import ExportManager from '../exports/ExportManager';
import RegistryPush from '../exports/RegistryPush';

interface EEOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EEOperationsModal: React.FC<EEOperationsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTabKey, setActiveTabKey] = useState<string | number>(0);

  const handleTabClick = (event: React.MouseEvent<HTMLElement, MouseEvent>, tabIndex: string | number) => {
    setActiveTabKey(tabIndex);
  };

  return (
    <Modal
      variant={ModalVariant.large}
      title="Execution Environment Operations"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div style={{ padding: '1rem' }}>
        <Tabs
          activeKey={activeTabKey}
          onSelect={handleTabClick}
          mountOnEnter
          unmountOnExit
        >
          <Tab
            eventKey={0}
            title={
              <TabTitleText>
                <DownloadIcon /> Export & Download
              </TabTitleText>
            }
          >
            <ExportManager />
          </Tab>
          
          <Tab
            eventKey={1}
            title={
              <TabTitleText>
                <CloudUploadAltIcon /> Push to Registry
              </TabTitleText>
            }
          >
            <RegistryPush />
          </Tab>
        </Tabs>
      </div>
    </Modal>
  );
};

export default EEOperationsModal;
