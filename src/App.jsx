import { useState } from "react";
import Form from "./componentes/form/Form";
import { BrowserRouter as Router,Routes,Route} from "react-router-dom";
import Login from "./componentes/login/login";
function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <Router>
      <Routes>
        <Route path="/" element={<Form/>}/>
        <Route path="/login" element={<Login/>}/>        
      </Routes>
      </Router>
    </>
  );
}

export default App;
