import React from 'react';
import styles from './NoteInput.module.css';

interface RecordButtonProps {
  isRecording: boolean;
  isPressed: boolean;
  disabled: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

const RecordButton: React.FC<RecordButtonProps> = ({
  isRecording,
  isPressed,
  disabled,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onClick,
}) => {
  const buttonClasses = [
    styles.recordButton,
    isRecording ? styles.recording : '',
    isPressed ? styles.pressed : '',
  ].filter(Boolean).join(' ');

  const dotClasses = [
    styles.recordDot,
    isRecording ? styles.pulsing : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={buttonClasses}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
    >
      <div className={dotClasses} />
      {isRecording ? "🔴 Recording..." : "🎤 Hold to Record"}
    </button>
  );
};

export default RecordButton; 