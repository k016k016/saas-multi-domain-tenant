'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrgSwitcherProps {
  currentOrg: Organization;
  availableOrgs: Organization[];
}

export default function OrgSwitcher({ currentOrg, availableOrgs }: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleSwitchOrg = async (orgSlug: string) => {
    setIsOpen(false);

    // /switch-org へフォーム送信で組織切替
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/switch-org';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'orgSlug';
    input.value = orgSlug;

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '0.5rem 1rem',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        {currentOrg.name}
        <span style={{ fontSize: '0.8em' }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '0.25rem',
          background: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          minWidth: '200px',
          zIndex: 1000
        }}>
          {availableOrgs.map(org => (
            <button
              key={org.id}
              onClick={() => handleSwitchOrg(org.slug)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: org.id === currentOrg.id ? '#f3f4f6' : 'white',
                color: '#1a1a1a',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                borderBottom: '1px solid #e5e5e5'
              }}
              onMouseEnter={(e) => {
                if (org.id !== currentOrg.id) {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (org.id !== currentOrg.id) {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              {org.name}
              {org.id === currentOrg.id && (
                <span style={{ marginLeft: '0.5rem', color: '#2563eb' }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
