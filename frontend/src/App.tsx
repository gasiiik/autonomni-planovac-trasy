import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';
import Home from './pages/Home';
import Wizard from './pages/Wizard';
import Result from './pages/Result';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="wizard" element={<Wizard />} />
          <Route path="result" element={<Result />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App;
