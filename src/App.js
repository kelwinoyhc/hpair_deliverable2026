import React from 'react';
import BrandMark from './components/BrandMark';
import MultiStepForm from './components/MultiStepForm';
import AdminGate from './components/admin/AdminGate';
import AdminView from './components/admin/AdminView';
import { useHashRoute } from './hooks/useHashRoute';
import './App.css';

/**
 * No router; see hooks/useHashRoute.js for why.
 *
 * The masthead and the page title are separate bands: the crimson band is the
 * organisation's identity and stays constant, while the white band below it says
 * what this particular page is. Collapsing them into one would make the brand
 * lockup compete with the page's own heading.
 */
export default function App() {
  const route = useHashRoute();
  const isAdmin = route === 'admin';

  return (
    <div className="App" id="top">
      <a className="skip-link" href={isAdmin ? '#admin-main' : '#form'}>
        Skip to content
      </a>

      <header className="App-header">
        <div className="header-inner">
          <BrandMark tone="light" />
        </div>
      </header>

      <div className="page-title">
        <div className="page-title-inner">
          <p className="eyebrow">{isAdmin ? 'Internal' : 'Delegate Application'}</p>
          <h1>{isAdmin ? 'Submitted applications' : 'Tell us about yourself'}</h1>
          {!isAdmin && (
            <p>
              A few details so we can process your application and reach you. It takes about
              three minutes, and your progress is saved as you go.
            </p>
          )}
        </div>
      </div>

      {isAdmin ? (
        <main className="container" id="admin-main">
          <div className="form-container">
            <AdminGate>
              <AdminView />
            </AdminGate>
          </div>
        </main>
      ) : (
        <main className="container" id="form">
          <div className="form-container">
            <MultiStepForm />
          </div>
          <p className="footnote">
            Your answers are saved in this browser as you type, and are not sent anywhere until
            you press submit.
          </p>
        </main>
      )}
    </div>
  );
}
