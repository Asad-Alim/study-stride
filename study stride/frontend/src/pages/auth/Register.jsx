// src/pages/auth/Register.jsx  (FULL REPLACEMENT)

import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';

const CLASS_OPTIONS = [
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11 (Science)', 'Class 11 (Commerce)', 'Class 11 (Arts)',
  'Class 12 (Science)', 'Class 12 (Commerce)', 'Class 12 (Arts)',
  'B.Tech 1st Year', 'B.Tech 2nd Year', 'B.Tech 3rd Year', 'B.Tech 4th Year',
  'B.Sc 1st Year', 'B.Sc 2nd Year', 'B.Sc 3rd Year',
  'B.Com 1st Year', 'B.Com 2nd Year', 'B.Com 3rd Year',
  'M.Tech / M.Sc / MBA', 'Competitive Exam Prep', 'Other',
];

const Register = () => {
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    age: '', gender: '', declaredLevel: '',
  });
  const [photo, setPhoto] = useState(null);      // base64 preview
  const [photoFile, setPhotoFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const photoRef = useRef();

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.declaredLevel) return setError('Please select your class/level');
    setLoading(true);
    setError('');
    try {
      // Pass extra fields to register — AuthContext will store them
      await register(form.name, form.email, form.password, {
        age: form.age,
        gender: form.gender,
        declaredLevel: form.declaredLevel,
        photo: photo || null,         // base64 string stored in user object
        classEnrolledAt: new Date().toISOString(),
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-1)] py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent)] text-white font-bold text-lg mb-4">S</div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Create your account</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Start your learning workspace</p>
        </div>

        <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          {error && <div className="text-xs text-[var(--critical)] bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">{error}</div>}

          <form onSubmit={submit} className="space-y-3">

            {/* Profile photo */}
            <div className="flex flex-col items-center gap-2 pb-2">
              <div
                onClick={() => photoRef.current.click()}
                className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] cursor-pointer flex items-center justify-center overflow-hidden transition-colors"
                title="Upload profile photo"
              >
                {photo
                  ? <img src={photo} alt="profile" className="w-full h-full object-cover" />
                  : <span className="text-2xl">📷</span>
                }
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {photo ? 'Photo added ✓' : 'Add profile photo (optional)'}
              </span>
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Full Name</label>
              <input type="text" name="name" value={form.name} onChange={handle} required
                className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={handle} required
                className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Password</label>
              <input type="password" name="password" value={form.password} onChange={handle} required
                className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>

            {/* Age + Gender side by side */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Age</label>
                <input type="number" name="age" value={form.age} onChange={handle} min="5" max="35" placeholder="e.g. 16"
                  className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Gender</label>
                <select name="gender" value={form.gender} onChange={handle}
                  className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not">Prefer not to say</option>
                </select>
              </div>
            </div>

            {/* Class / Level */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Class / Level <span className="text-[var(--critical)]">*</span></label>
              <select name="declaredLevel" value={form.declaredLevel} onChange={handle} required
                className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
                <option value="">Select your class or level…</option>
                {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-1">AI explanations will be tailored to this level</p>
            </div>

            <Button type="submit" loading={loading} className="w-full justify-center mt-2">Create account</Button>
          </form>

          <p className="text-xs text-center text-[var(--text-muted)]">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--accent)] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;