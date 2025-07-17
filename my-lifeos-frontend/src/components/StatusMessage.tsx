import React from 'react';
import styles from './NoteInput.module.css';

interface StatusMessageProps {
  message: string;
  isError?: boolean;
}

const StatusMessage: React.FC<StatusMessageProps> = ({ message, isError = false }) => {
  const statusClasses = [
    styles.status,
    isError ? styles.error : styles.success,
  ].join(' ');

  return (
    <div className={statusClasses}>
      {message}
    </div>
  );
};

export default StatusMessage; 