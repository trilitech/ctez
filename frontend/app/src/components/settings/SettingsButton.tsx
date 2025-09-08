import React from 'react';
import Button from '../button';
import { ReactComponent as SettingsIcon } from '../../assets/images/icons/settings.svg';

interface ISettingsButtonProps {
  onClick: () => void;
}

const SettingsButton: React.FC<ISettingsButtonProps> = ({ onClick }) => {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-label="Open settings"
      title="Open settings"
    >
      <SettingsIcon aria-hidden="true" focusable="false" />
    </Button>
  );
};

export { SettingsButton };
