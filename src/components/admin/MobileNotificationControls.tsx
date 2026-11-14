import React from 'react';
import NotificationBroadcastHub from './NotificationBroadcastHub';

interface MobileNotificationControlsProps {
  clinicName?: string;
  onClose?: () => void;
}

export default function MobileNotificationControls({
  clinicName,
  onClose,
}: MobileNotificationControlsProps) {
  return <NotificationBroadcastHub clinicName={clinicName} variant="modal" onClose={onClose} />;
}
