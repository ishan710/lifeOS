"use client";
import React, { useState, useEffect } from "react";
import { getTasks, completeTask } from "../lib/api";

interface Task {
  id: number;
  task_type: string;
  title: string;
  description?: string;
  due_date?: string;
  status: string;
  created_at: string;
}

interface TaskDashboardProps {
  userName: string;
}

const TaskDashboard: React.FC<TaskDashboardProps> = ({ userName }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [userName]);

  const loadTasks = async () => {
    try {
      const taskList = await getTasks(userName);
      setTasks(taskList);
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await completeTask(taskId);
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, status: 'completed' } : task
      ));
    } catch (error) {
      console.error("Error completing task:", error);
    }
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'calendar': return '📅';
      case 'reminder': return '⏰';
      case 'diary': return '📝';
      default: return '📋';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", padding: 24 }}>
      <h2>Your Tasks</h2>
      {tasks.length === 0 ? (
        <p>No tasks yet. Add a note to create tasks!</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 16,
                backgroundColor: task.status === 'completed' ? '#f8f9fa' : 'white',
                opacity: task.status === 'completed' ? 0.7 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{getTaskIcon(task.task_type)}</span>
                  <div>
                    <h3 style={{ margin: 0, textDecoration: task.status === 'completed' ? 'line-through' : 'none' }}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p style={{ margin: "4px 0", color: "#666" }}>{task.description}</p>
                    )}
                    <div style={{ fontSize: 12, color: "#888" }}>
                      <span>Type: {task.task_type}</span>
                      {task.due_date && (
                        <span style={{ marginLeft: 12 }}>Due: {formatDate(task.due_date)}</span>
                      )}
                    </div>
                  </div>
                </div>
                {task.status === 'pending' && (
                  <button
                    onClick={() => handleCompleteTask(task.id)}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskDashboard; 