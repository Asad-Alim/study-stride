// src/pages/Profile.jsx  (FULL REPLACEMENT)

import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/common/Button';

const CLASS_OPTIONS = [
  'Class 1','Class 2','Class 3','Class 4','Class 5',
  'Class 6','Class 7','Class 8','Class 9','Class 10',
  'Class 11 (Science)','Class 11 (Commerce)','Class 11 (Arts)',
  'Class 12 (Science)','Class 12 (Commerce)','Class 12 (Arts)',
  'B.Tech 1st Year','B.Tech 2nd Year','B.Tech 3rd Year','B.Tech 4th Year',
  'B.Sc 1st Year','B.Sc 2nd Year','B.Sc 3rd Year',
  'B.Com 1st Year','B.Com 2nd Year','B.Com 3rd Year',
  'M.Tech / M.Sc / MBA','Competitive Exam Prep','Other',
];

const Profile = () => {
  const { user, updateProfile, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    declaredLevel: user?.declaredLevel || '',
    age: user?.age || '',
    gender: user?.gender || '',
  });
  const [saved, setSaved] = useState(false);
  const photoRef = useRef();

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => updateProfile({ photo: ev.target.result });
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    updateProfile(form);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-lg mx-auto">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Profile</h1>

        <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl p-6 space-y-5">

          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div
              onClick={() => photoRef.current.click()}
              className="w-16 h-16 rounded-2xl overflow-hidden bg-[var(--accent)] flex items-center justify-center cursor-pointer relative group"
              title="Click to change photo"
            >
              {user?.photo
                ? <img src={user.photo} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-white text-xl font-bold">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
              }
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-lg">📷</span>
              </div>
            </div>
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            <div>
              <p className="font-semibold text-[var(--text-primary)]">{user?.name}</p>
              <p className="text-sm text-[var(--text-muted)]">{user?.email}</p>
              {user?.declaredLevel && (
                <span className="inline-block mt-1 text-xs bg-[var(--surface-2)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full">
                  {user.declaredLevel}
                </span>
              )}
            </div>
          </div>

          <hr className="border-[var(--border)]" />

          {/* Editable fields */}
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Class / Level</label>
                <select
                  value={form.declaredLevel}
                  onChange={e => setForm(f => ({ ...f, declaredLevel: e.target.value }))}
                  className="mt-1 w-full border border-[var(--border)] rounded-xl bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Age</label>
                  <input type="number" min="5" max="35"
                    value={form.age}
                    onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                    className="mt-1 w-full border border-[var(--border)] rounded-xl bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Gender</label>
                  <select
                    value={form.gender}
                    onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                    className="mt-1 w-full border border-[var(--border)] rounded-xl bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={handleSave}>Save changes</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Name', value: user?.name },
                { label: 'Email', value: user?.email },
                { label: 'Class / Level', value: user?.declaredLevel || '—' },
                { label: 'Age', value: user?.age || '—' },
                { label: 'Gender', value: user?.gender ? user.gender.replace('_', ' ') : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{label}</label>
                  <p className="mt-1 text-sm text-[var(--text-primary)] bg-[var(--surface-1)] border border-[var(--border)] rounded-xl px-4 py-2.5 capitalize">{value}</p>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-1">
                <Button variant="outline" onClick={() => setEditing(true)}>Edit Profile</Button>
                {saved && <span className="text-xs text-green-600">✓ Saved</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;