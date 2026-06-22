import { createContext, useContext, useState } from 'react';
import api from '../api/axios';

const MaterialContext = createContext();

export const MaterialProvider = ({ children }) => {
  const [topics, setTopics] = useState([]);

  // "materials" kept as alias so Dashboard doesn't need changing
  const materials = topics;

  const fetchMaterials = async () => {
    const res = await api.get('/topics');
    setTopics(res.data);
  };

  // Supports single or multiple files
  // Returns { topic, materials }
  const uploadMaterial = async (files, title, subject = '') => {
    const form = new FormData();
    const fileArray = Array.isArray(files) ? files : [files];
    fileArray.forEach(f => form.append('files', f));
    form.append('topicTitle', title);
    if (subject) form.append('subject', subject);
    const res = await api.post('/materials', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    // Add the new topic to local state
    setTopics(prev => [res.data.topic, ...prev]);
    return res.data; // { topic, materials }
  };

  // Add more files to an existing topic
  const addFilesToTopic = async (topicId, files) => {
    const form = new FormData();
    const fileArray = Array.isArray(files) ? files : [files];
    fileArray.forEach(f => form.append('files', f));
    form.append('topicId', topicId);
    const res = await api.post('/materials', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    // Refresh topics
    const updated = await api.get('/topics');
    setTopics(updated.data);
    return res.data;
  };

  const deleteMaterial = async (topicId) => {
    await api.delete(`/topics/${topicId}`);
    setTopics(prev => prev.filter(t => t._id !== topicId));
  };

  const deleteSingleFile = async (materialId, topicId) => {
    await api.delete(`/materials/${materialId}`);
    const updated = await api.get('/topics');
    setTopics(updated.data);
  };

  return (
    <MaterialContext.Provider value={{
      materials,
      topics,
      fetchMaterials,
      uploadMaterial,
      addFilesToTopic,
      deleteMaterial,
      deleteSingleFile,
    }}>
      {children}
    </MaterialContext.Provider>
  );
};

export const useMaterial = () => useContext(MaterialContext);