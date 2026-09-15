import React from 'react';
import BrandMark from './components/BrandMark';
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
 *
 * The masthead and the page title are separate bands: the crimson band is the
 * organisation's identity and stays constant, while the white band below it says
 * what this particular page is. Collapsing them into one would make the brand
 * lockup compete with the form's own heading.
 */
export default function App() {
  return (
    <div className="App">
      <a className="skip-link" href="#form">
        Skip to form
      </a>

      <header className="App-header">
        <div className="header-inner">
          <BrandMark tone="light" />
        </div>
      </header>

      <div className="page-title">
        <div className="page-title-inner">
          <p className="eyebrow">Delegate Application</p>
          <h1>Tell us about yourself</h1>
          <p>
            A few details so we can process your application and reach you. It takes about three
            minutes, and your progress is saved as you go.
          </p>
        </div>
      </div>

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
