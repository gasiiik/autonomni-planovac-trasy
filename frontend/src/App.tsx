import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';
import Home from './pages/Home';
import Wizard from './pages/Wizard';
import Result from './pages/Result';
import MapPage from './pages/MapPage';
import PlaceDetail from './pages/PlaceDetail';
import Events from './pages/Events';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="wizard" element={<Wizard />} />
          <Route path="result" element={<Result />} />
          <Route path="mapa" element={<MapPage />} />
          <Route path="misto/:id" element={<PlaceDetail />} />
          <Route path="akce" element={<Events />} />
          {/* Neexistující adresa (např. zrušená /o-datech) -> úvodní stránka */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App;
