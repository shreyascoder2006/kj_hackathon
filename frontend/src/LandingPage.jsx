import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

// ─── Animated Background (ColorBends) ────────────────────────────────────────
function ColorBends() {
  return (
    <div className="color-bends-bg">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="blob blob-4" />
      <div className="blob blob-5" />
      {/* Scanlines overlay */}
      <div className="scanlines" />
      {/* Grid overlay */}
      <div className="grid-overlay" />
    </div>
  );
}

// ─── Intersection Observer Hook ───────────────────────────────────────────────
function useFadeIn(delay = 0) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add('visible'), delay);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);
  return ref;
}

// ─── Typewriter Hook ──────────────────────────────────────────────────────────
function useTypewriter(words, speed = 80, pause = 2000) {
  const [display, setDisplay] = useState('');
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[wordIdx];
    let timeout;
    if (!deleting && charIdx <= word.length) {
      timeout = setTimeout(() => setCharIdx(c => c + 1), speed);
    } else if (!deleting && charIdx > word.length) {
      timeout = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && charIdx >= 0) {
      timeout = setTimeout(() => setCharIdx(c => c - 1), speed / 2);
    } else {
      setDeleting(false);
      setWordIdx(i => (i + 1) % words.length);
    }
    setDisplay(word.slice(0, charIdx));
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, wordIdx, words, speed, pause]);

  return display;
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const startTime = performance.now();
        const step = (now) => {
          const progress = Math.min((now - startTime) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * target));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Feature Card ─────────────────────────────────────────────────────────────
const FEATURE_COLORS = [
  { from: '#6366f1', to: '#a855f7' },
  { from: '#00ff88', to: '#06b6d4' },
  { from: '#ef4444', to: '#ec4899' },
  { from: '#f59e0b', to: '#ef4444' },
];

const FEATURES = [
  {
    icon: '🔗',
    tag: 'GRAPH ENGINE',
    title: 'Graph Intelligence',
    desc: 'Visualize fund flow across accounts with interactive network graphs. Detect circular transactions and hidden connections in real time.',
    stat: '100+ nodes',
  },
  {
    icon: '🧠',
    tag: 'ML MODEL',
    title: 'AI Fraud Detection',
    desc: 'Detect anomalies using Isolation Forest ML model combined with rule-based heuristics for explainable, multi-layered analysis.',
    stat: '8 risk patterns',
  },
  {
    icon: '🚨',
    tag: 'LIVE SYSTEM',
    title: 'Real-Time Alerts',
    desc: 'Instant alerts for suspicious activities — structuring, velocity spikes, dormant account reactivation, and location anomalies.',
    stat: '< 1s latency',
  },
  {
    icon: '🔍',
    tag: 'FORENSICS',
    title: 'Investigator Tools',
    desc: 'Deep dive into transactions with 8+ filters, confidential risk reports, timeline playback, and full audit trail for forensic analysis.',
    stat: '8+ filters',
  },
];

const STATS = [
  { value: 100, suffix: '', label: 'Accounts Monitored' },
  { value: 18600, suffix: '+', label: 'Transactions Scanned' },
  { value: 8, suffix: '', label: 'Detection Rules' },
  { value: 99, suffix: '%', label: 'Detection Accuracy' },
];

const barHeights = [35, 55, 40, 70, 50, 80, 45, 65, 55, 75, 40, 85, 60, 50, 70, 45, 90, 55, 65, 80];
const barColors  = ['#6366f1', '#a855f7', '#06b6d4', '#00ff88', '#ec4899', '#ef4444', '#f59e0b'];

// ─── Landing Page ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  const featuresRef = useFadeIn(0);
  const statsRef    = useFadeIn(100);
  const previewRef  = useFadeIn(200);
  const ctaRef      = useFadeIn(300);

  const typedText = useTypewriter(
    ['Track. Detect. Prevent.', 'Secure. Monitor. Protect.', 'Analyze. Alert. Act.'],
    70,
    2200
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <ColorBends />
      <div className="bg-overlay" />

      <div className="landing-page">

        {/* ─── Navbar ──────────────────────────────────────────── */}
        <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
          <div className="nav-logo">
            <span className="nav-logo-icon">⬡</span>
            <span className="nav-logo-text">FRAUDGUARD</span>
          </div>
          <div className="nav-links">
            <button className="nav-link" onClick={() => scrollTo('features')}>Features</button>
            <button className="nav-link" onClick={() => scrollTo('preview')}>About</button>
            <button className="nav-login-btn" onClick={() => navigate('/login')}>
              <span className="login-btn-dot" />
              LOGIN
            </button>
          </div>
        </nav>

        {/* ─── Hero ────────────────────────────────────────────── */}
        <section className="hero-section">
          {/* Floating orbs for depth */}
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />

          <div className="hero-badge">
            <span className="hero-badge-dot" />
            TRACKING OF FUNDS WITHIN BANK FOR FRAUD DETECTION
          </div>

          <h1 className="hero-title">
            <span className="accent">Fraud</span>Guard
          </h1>

          <p className="hero-subtitle">
            AI-Powered Fund Flow Tracking for Advanced Fraud Detection
          </p>

          <div className="hero-typewriter">
            <span className="typewriter-text">{typedText}</span>
            <span className="typewriter-cursor">|</span>
          </div>

          <div className="hero-buttons">
            <button className="btn-launch" onClick={() => navigate('/dashboard')}>
              <span className="btn-icon">⚡</span>
              Launch Dashboard
            </button>
            <button className="btn-demo" onClick={() => scrollTo('features')}>
              <span className="btn-icon">▶</span>
              View Demo
            </button>
          </div>

          {/* Tech badges */}
          <div className="hero-tech-badges">
            {['React + Vite', 'Node.js', 'Isolation Forest ML', 'Real-Time'].map(t => (
              <span key={t} className="tech-badge">{t}</span>
            ))}
          </div>

          <button className="hero-scroll-indicator" onClick={() => scrollTo('stats')}>
            <span className="scroll-arrow">↓</span>
          </button>
        </section>

        {/* ─── Stats Bar ────────────────────────────────────────── */}
        <section id="stats" className="stats-section fade-in-section" ref={statsRef}>
          <div className="stats-grid">
            {STATS.map((s, i) => (
              <div key={i} className="stat-item">
                <div className="stat-value">
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Features ────────────────────────────────────────── */}
        <section id="features" className="features-section fade-in-section" ref={featuresRef}>
          <div className="section-eyebrow">CAPABILITIES</div>
          <h2 className="section-title">Intelligent Fraud Detection Engine</h2>
          <p className="section-desc">
            Purpose-built tools to track, analyze, and neutralize financial threats before they escalate.
          </p>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="feature-card"
                style={{ '--card-from': FEATURE_COLORS[i].from, '--card-to': FEATURE_COLORS[i].to }}
              >
                <div className="feature-card-tag">{f.tag}</div>
                <span className="feature-icon">{f.icon}</span>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
                <div className="feature-stat">{f.stat}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Preview ─────────────────────────────────────────── */}
        <section id="preview" className="preview-section fade-in-section" ref={previewRef}>
          <div className="section-eyebrow">LIVE SYSTEM PREVIEW</div>
          <h2 className="section-title">Real-Time Fraud Monitoring Dashboard</h2>
          <div className="preview-wrapper">
            {/* Left: Alert Feed */}
            <div className="preview-alert-feed">
              <div className="feed-header">
                <span className="feed-title">⚡ LIVE ALERTS</span>
                <span className="feed-badge">ACTIVE</span>
              </div>
              {[
                { sev: 'high',   icon: '🔴', msg: 'Circular flow: A1→A2→A3→A1', time: '09:12' },
                { sev: 'high',   icon: '🔴', msg: 'Dormant account reactivated: A4', time: '09:18' },
                { sev: 'medium', icon: '🟡', msg: 'Velocity spike detected: A2', time: '09:19' },
                { sev: 'medium', icon: '🟡', msg: 'Structuring pattern: A1 (3× ₹9,200)', time: '10:05' },
                { sev: 'low',    icon: '🔵', msg: 'Device change: A3 mobile→desktop', time: '10:08' },
              ].map((a, i) => (
                <div key={i} className={`feed-alert severity-${a.sev}`} style={{ animationDelay: `${i * 0.3}s` }}>
                  <span className="feed-icon">{a.icon}</span>
                  <div className="feed-detail">
                    <span className="feed-msg">{a.msg}</span>
                    <span className="feed-time">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Mockup window */}
            <div className="preview-mockup">
              <div className="preview-titlebar">
                <span className="preview-dot red" />
                <span className="preview-dot yellow" />
                <span className="preview-dot green" />
                <span className="preview-url">fraudguard.local/dashboard</span>
              </div>
              <div className="preview-content">
                <div className="preview-stat">
                  <div className="preview-stat-value" style={{ color: '#00ff88' }}>100</div>
                  <div className="preview-stat-label">Accounts Monitored</div>
                </div>
                <div className="preview-stat">
                  <div className="preview-stat-value" style={{ color: '#ef4444' }}>18,600+</div>
                  <div className="preview-stat-label">Transactions Scanned</div>
                </div>
                <div className="preview-stat">
                  <div className="preview-stat-value" style={{ color: '#a855f7' }}>⚡ Active</div>
                  <div className="preview-stat-label">ML Risk Engine</div>
                </div>
              </div>
              <div className="preview-graph-area">
                {barHeights.map((h, i) => (
                  <div
                    key={i}
                    className="preview-bar"
                    style={{
                      height: `${h}%`,
                      background: barColors[i % barColors.length],
                      opacity: 0.75,
                      animationDelay: `${i * 0.07}s`,
                    }}
                  />
                ))}
              </div>
              <div className="preview-network">
                {['A1','A2','A3','A4','A5'].map((id, i) => (
                  <div key={id} className={`net-node ${i < 3 ? 'net-node-hot' : 'net-node-safe'}`}
                    style={{ left: `${15 + i * 17}%`, top: i % 2 === 0 ? '30%' : '60%' }}>
                    {id}
                  </div>
                ))}
                <svg className="net-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Simplified edges */}
                  {[['15','30','32','60'],['32','60','49','30'],['49','30','66','60'],['66','60','83','30'],['83','30','15','30']].map(([x1,y1,x2,y2],i) => (
                    <line key={i} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                      stroke={i === 4 ? '#ef4444' : 'rgba(255,255,255,0.15)'}
                      strokeWidth={i === 4 ? '0.5' : '0.3'}
                      strokeDasharray={i === 4 ? '2 1' : 'none'}
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>
          <div className="preview-label">Real-time fraud monitoring dashboard · All data is synthetic for demo</div>
        </section>

        {/* ─── CTA ─────────────────────────────────────────────── */}
        <section className="cta-section fade-in-section" ref={ctaRef}>
          <div className="cta-box">
            <div className="cta-icon">🛡️</div>
            <div className="section-eyebrow" style={{ marginBottom: 16 }}>START PROTECTING TODAY</div>
            <h2 className="cta-title">Ready to detect fraud before it happens?</h2>
            <p className="cta-subtitle">
              Deploy FraudGuard to monitor, analyze, and prevent financial fraud with AI-powered intelligence.
            </p>
            <div className="cta-buttons">
              <button className="btn-cta" onClick={() => navigate('/dashboard')}>
                Get Started →
              </button>
              <button className="btn-cta-outline" onClick={() => navigate('/login')}>
                Login to System
              </button>
            </div>
            <div className="cta-trust">
              <span>✓ No setup needed</span>
              <span>✓ 100 accounts pre-loaded</span>
              <span>✓ ML engine ready</span>
            </div>
          </div>
        </section>

        {/* ─── Footer ──────────────────────────────────────────── */}
        <footer className="landing-footer">
          <div className="footer-logo">
            <span className="nav-logo-icon" style={{ fontSize: '1.2rem' }}>⬡</span>
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.08em' }}>FRAUDGUARD</span>
          </div>
          <div className="footer-line">Built for Hackathon Demo · © 2026 FraudGuard</div>
          <div className="footer-team">Team KJ — Tracking of Funds Within Bank for Fraud Detection</div>
        </footer>
      </div>
    </>
  );
}
