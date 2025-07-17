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
    if (!userName) {
      console.log("No userName provided, skipping task load");
      setTasks([]);
      setLoading(false);
      return;
    }

    console.log("Loading tasks for user:", userName);
    
    try {
      const response = await getTasks(userName);
      console.log("Full API response:", response);
      
      // Handle different possible response structures
      let tasksData = [];
      
      if (response && typeof response === 'object') {
        if (Array.isArray(response)) {
          // Response is directly an array
          tasksData = response;
        } else if (response.data && Array.isArray(response.data)) {
          // Response has data property with array
          tasksData = response.data;
        } else if ((response as any).tasks && Array.isArray((response as any).tasks)) {
          // Response has tasks property with array (type cast for flexibility)
          tasksData = (response as any).tasks;
        } else {
          console.warn("Unexpected response structure:", response);
          tasksData = [];
        }
      } else {
        console.warn("Response is not an object:", typeof response, response);
        tasksData = [];
      }
      
      console.log("Extracted tasks data:", tasksData);
      console.log("Tasks data is array:", Array.isArray(tasksData));
      
      setTasks(tasksData);
    } catch (error) {
      console.error("Error loading tasks:", error);
      setTasks([]); // Ensure tasks is always an array
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await completeTask(taskId);
      // Ensure tasks is always an array before mapping
      const currentTasks = Array.isArray(tasks) ? tasks : [];
      setTasks(currentTasks.map(task => 
        task.id === taskId ? { ...task, status: 'completed' } : task
      ));
    } catch (error) {
      console.error("Error completing task:", error);
    }
  };

  const testAPICall = async () => {
    console.log("=== TESTING API CALL ===");
    try {
      const response = await fetch(`http://localhost:8000/api/tasks?user_name=${encodeURIComponent(userName)}`);
      const data = await response.json();
      console.log("Raw fetch response:", data);
      console.log("Response type:", typeof data);
      console.log("Is array:", Array.isArray(data));
      if (data && typeof data === 'object') {
        console.log("Object keys:", Object.keys(data));
      }
    } catch (error) {
      console.error("Raw fetch error:", error);
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

  // Safety check and debugging
  console.log("About to render, tasks:", tasks);
  console.log("tasks is array:", Array.isArray(tasks));
  console.log("tasks type:", typeof tasks);
  
  // Ensure tasks is always an array before rendering
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Your Tasks</h2>
        <div>
          <button 
            onClick={loadTasks}
            style={{ 
              padding: "8px 16px", 
              marginRight: 8, 
              backgroundColor: "#007bff", 
              color: "white", 
              border: "none", 
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Refresh Tasks
          </button>
          <button 
            onClick={testAPICall}
            style={{ 
              padding: "8px 16px", 
              backgroundColor: "#28a745", 
              color: "white", 
              border: "none", 
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Test API
          </button>
        </div>
      </div>
      {safeTasks.length === 0 ? (
        <p>No tasks yet. Add a note to create tasks!</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {safeTasks.map((task) => (
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