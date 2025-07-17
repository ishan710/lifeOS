"use client";
import React, { useEffect, useState } from "react";
import { getIdeaGraph } from "../lib/api";

interface Idea {
  id: number;
  content: string;
  mood?: string;
  tags?: string[];
  created_at: string;
}

interface IdeaListProps {
  userName: string;
}

const IdeaList: React.FC<IdeaListProps> = ({ userName }) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIdeas() {
      setLoading(true);
      const graph = await getIdeaGraph(userName);
      setIdeas(graph.nodes || []);
      setLoading(false);
    }
    if (userName) fetchIdeas();
  }, [userName]);

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", padding: 24 }}>
      <h2>Your Ideas & Thoughts</h2>
      {loading ? (
        <p>Loading...</p>
      ) : ideas.length === 0 ? (
        <p>No ideas yet. Add a note and mark it as a diary entry!</p>
      ) : (
        <ul>
          {ideas.map((idea) => (
            <li key={idea.id} style={{ marginBottom: 12 }}>
              <strong>{idea.content}</strong>
              {idea.mood && <> | Mood: {idea.mood}</>}
              {idea.tags && idea.tags.length > 0 && <> | Tags: {idea.tags.join(", ")}</>}
              <span style={{ color: "#888", marginLeft: 8 }}>
                ({new Date(idea.created_at).toLocaleString()})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default IdeaList; 