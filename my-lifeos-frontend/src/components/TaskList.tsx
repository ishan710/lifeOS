import React from 'react';
import styles from './NoteInput.module.css';

interface TaskListProps {
  tasks: string[];
}

const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  return (
    <div className={styles.tasksContainer}>
      <strong className={styles.tasksTitle}>Created tasks:</strong>
      <ul className={styles.tasksList}>
        {tasks.map((task, index) => (
          <li key={index}>{task}</li>
        ))}
      </ul>
    </div>
  );
};

export default TaskList; 