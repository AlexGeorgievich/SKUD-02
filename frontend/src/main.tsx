import {createRoot} from 'react-dom/client';
import App from './app/App';
import './shared/styles/base.css';
import './shared/styles/react.css';
createRoot(document.getElementById('root')!).render(<App/>);
