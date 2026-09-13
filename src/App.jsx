import { useState } from 'react';
import CalculadoraHidraulica from './components/CalculadoraHidraulica';
import AsistenteManuales from './components/AsistenteManuales';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('hidraulica');

  return (
    <div className="ptoi-app">
      <header className="ptoi-header">
        <h2>⚡ PTOI - Gestor Táctico Operativo UME</h2>
        <div className="ptoi-tabs">
          <button
            className={activeTab === 'hidraulica' ? 'active' : ''}
            onClick={() => setActiveTab('hidraulica')}
          >
            Calculadora Hidráulica
          </button>
          <button
            className={activeTab === 'manuales' ? 'active' : ''}
            onClick={() => setActiveTab('manuales')}
          >
            Asistente de Manuales
          </button>
        </div>
      </header>

      {activeTab === 'hidraulica' ? <CalculadoraHidraulica /> : <AsistenteManuales />}
    </div>
  );
}

export default App;
