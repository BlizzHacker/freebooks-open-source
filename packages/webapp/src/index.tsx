// @ts-nocheck
import 'regenerator-runtime/runtime';
import './wdyr';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { PersistGate } from 'redux-persist/integration/react';
import '@/services/yup';
import App from '@/components/App';
import * as serviceWorker from '@/serviceWorker';
import { store, persistor } from '@/store/create-store';

ReactDOM.render(
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistGate>
  </Provider>,
  document.getElementById('root'),
);

// Install support only: this service worker does not cache financial data.
serviceWorker.register();
