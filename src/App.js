import React from 'react';
import MultiStepForm from './components/MultiStepForm';
import './App.css';

/**
 * No router.
 *
 * The app is a single form whose position is wizard state, not a URL. Adding
 * react-router would mean either deep links that can be opened mid-form with no
 * answers behind them, or routes guarded well enough to be unreachable -- plus a
 * `vercel.json` rewrite so a refresh on /step/2 doesn't 404. None of that buys
 * the user anything here, so the dependency is gone.
 */
export default function App() {
  return (
    <div className="App">
      <a className="skip-link" href="#form">
        Skip to form
      </a>

      <header className="App-header">
        <div className="header-inner">
          <p className="eyebrow">HPAIR</p>
          <h1>Delegate application</h1>
          <p>A few details so we can process your application and reach you.</p>
        </div>
      </header>

      <main className="container" id="form">
        <div className="form-container">
          <MultiStepForm />
        </div>
        <p className="footnote">
          Your answers are saved in this browser as you type, and are not sent anywhere until you
          press submit.
        </p>
      </main>
    </div>
  );
}
