import { useState } from 'react';
import CalculadoraHidraulica from './components/CalculadoraHidraulica';
import TiempoVaciado from './components/TiempoVaciado';
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
            className={activeTab === 'vaciado' ? 'active' : ''}
            onClick={() => setActiveTab('vaciado')}
          >
            Tiempo de Vaciado
          </button>
        </div>
      </header>

      {activeTab === 'hidraulica' && <CalculadoraHidraulica />}
      {activeTab === 'vaciado' && <TiempoVaciado />}
    </div>
  );
}

export default App;
