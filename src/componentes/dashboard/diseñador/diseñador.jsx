import { useState, useEffect } from "react";
import { supabase } from "../../../supabase/supabaseClient";
import { useNavigate } from "react-router-dom";
import Calculadora from "./calculadora/Calculadora";
import Contabilidad from "../contabilidad/contabilidad";
import "./diseñador.css";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast, Zoom } from "react-toastify";
import BlockchainViewer from "../../../blockchain/BlockchainViewer";
import { registrarBloque } from "../../../blockchain/blockchainService";
import HomeDashboard from "../inicio/HomeDashboard";
import PerfilModal from "../perfil/PerfilModal";
import "../perfil/PerfilModal.css";
import ChatbotWidget from "../../chatbot/ChatbotWidget"

const DashboardDisenador = () => {
  const [seccion, setSeccion] = useState("inicio");
  const [pedidos, setPedidos] = useState([]);
  const [disenos, setDisenos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState(null);

  // Modales pedidos
  const [mostrarModal, setMostrarModal] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [pedidoEditar, setPedidoEditar] = useState(null);
  const [esLetreroEditar, setEsLetreroEditar] = useState(false);
  const [stockDisponible, setStockDisponible] = useState(null);

  // Modales diseños
  const [mostrarModalDiseno, setMostrarModalDiseno] = useState(false);
  const [archivoDis, setArchivoDis] = useState(null);
  const [pedidoIdDiseno, setPedidoIdDiseno] = useState("");
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");
  const [modalVerPedido, setModalVerPedido] = useState(false);
  const [pedidoVer, setPedidoVer] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [perfil, setPerfil] = useState(null);

  const navigate = useNavigate();

  const pedidoInicial = {
    cliente_nombre: "",
    cliente_contacto: "",
    cantidad: 1,
    descuento: false,
    prioridad: "media",
    fecha_entrega: "",
    especificaciones: "",
    perfil_impresion: "",
    configuracion: "",
    estado: "en_diseño",
    material_id: "",
    esLetrero: false,
    letrero_tipo: "",
    letrero_alto: "",
    letrero_largo: "",
    precio_total: "",
    abono: "",
  };

  const [nuevoPedido, setNuevoPedido] = useState(pedidoInicial);

  useEffect(() => {
    cargarPedidos();
    cargarMateriales();
    cargarDisenos();
    supabase.auth.getUser().then(({ data }) => {
      setUsuario(data?.user);
      if (data?.user) {
        supabase
          .from("usuarios")
          .select("nombre, usuario, rol")
          .eq("id", data.user.id)
          .single()
          .then(({ data: p }) => {
            if (p) setPerfil(p);
          });
      }
    });
  }, []);

  // ─── CARGA ──────────────────────────────────────────────────────────

  const cargarPedidos = async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from("pedidos")
      .select("*, disenos(*)")
      .order("created_at", { ascending: false });
    if (!error) setPedidos(data);
    setCargando(false);
  };

  const cargarMateriales = async () => {
    const { data, error } = await supabase
      .from("materiales")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setMateriales(data);
  };

  const cargarDisenos = async () => {
    const { data, error } = await supabase
      .from("disenos")
      .select("*, pedidos(cliente_nombre, estado)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error cargarDisenos:", error.message);
    } else {
      setDisenos(data ?? []);
    }
  };

  const cambiarsesion = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // ─── PEDIDOS ────────────────────────────────────────────────────────

  const handleChangePedido = (e) => {
    const { name, value, type, checked } = e.target;
    const nuevoValor = type === "checkbox" ? checked : value;

    if (name === "esLetrero") {
      setNuevoPedido({
        ...nuevoPedido,
        esLetrero: checked,
        material_id: checked ? "" : nuevoPedido.material_id,
        letrero_tipo: checked ? nuevoPedido.letrero_tipo : "",
        letrero_alto: checked ? nuevoPedido.letrero_alto : "",
        letrero_largo: checked ? nuevoPedido.letrero_largo : "",
      });
      setStockDisponible(null);
      return;
    }

    if (name === "material_id") {
      setNuevoPedido({ ...nuevoPedido, [name]: nuevoValor });
      verificarStock(nuevoValor);
      return;
    }

    if (name === "cantidad") {
      setNuevoPedido({
        ...nuevoPedido,
        cantidad: value,
        descuento: parseInt(value) > 10,
      });
      return;
    }

    setNuevoPedido({ ...nuevoPedido, [name]: nuevoValor });
  };

  const agregarPedido = async () => {
    if (!nuevoPedido.cliente_nombre) return;

    const { data: userData } = await supabase.auth.getUser();
    const estadoFinal = nuevoPedido.esLetrero
      ? "en_diseño"
      : stockDisponible && stockDisponible.stock > 0
        ? "en_diseño"
        : "sin_material";

    const { data: pedidoCreado, error } = await supabase
      .from("pedidos")
      .insert({
        usuario_id: userData.user.id,
        cliente_nombre: nuevoPedido.cliente_nombre,
        cliente_contacto: nuevoPedido.cliente_contacto,
        cantidad: parseInt(nuevoPedido.cantidad),
        descuento: nuevoPedido.descuento,
        prioridad: nuevoPedido.prioridad,
        fecha_entrega: nuevoPedido.fecha_entrega || null,
        especificaciones: nuevoPedido.especificaciones,
        perfil_impresion: nuevoPedido.perfil_impresion,
        configuracion: nuevoPedido.configuracion,
        estado: estadoFinal,
        material_id: nuevoPedido.esLetrero
          ? null
          : nuevoPedido.material_id || null,
        letrero_tipo: nuevoPedido.esLetrero ? nuevoPedido.letrero_tipo : null,
        letrero_alto: nuevoPedido.esLetrero
          ? parseFloat(nuevoPedido.letrero_alto) || null
          : null,
        letrero_largo: nuevoPedido.esLetrero
          ? parseFloat(nuevoPedido.letrero_largo) || null
          : null,
        precio_total: nuevoPedido.precio_total
          ? parseFloat(nuevoPedido.precio_total)
          : null,
        abono: nuevoPedido.abono ? parseFloat(nuevoPedido.abono) : 0,
      })
      .select()
      .single();

    if (error) {
      console.error(error.message);
      return;
    }

    if (!nuevoPedido.esLetrero && nuevoPedido.material_id && pedidoCreado) {
      await supabase.from("pedido_materiales").insert({
        pedido_id: pedidoCreado.id,
        material_id: nuevoPedido.material_id,
        cantidad: parseInt(nuevoPedido.cantidad),
      });
    }

    setMostrarModal(false);
    setNuevoPedido(pedidoInicial);
    setStockDisponible(null);
    cargarPedidos();
    toast.success("Guardado exitosamente", {
      position: "bottom-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: false,
      pauseOnHover: true,
      draggable: true,
      theme: "dark",
      transition: Zoom,
    });
  };

  const abrirEditar = (pedido) => {
    setPedidoEditar({ ...pedido });
    setEsLetreroEditar(!!pedido.letrero_tipo);
    setModalEditar(true);
  };

  const handleChangeEditar = (e) => {
    const { name, value } = e.target;
    setPedidoEditar({ ...pedidoEditar, [name]: value });
  };

  const guardarEdicion = async () => {
    const { error } = await supabase
      .from("pedidos")
      .update({
        estado: pedidoEditar.estado,
        prioridad: pedidoEditar.prioridad,
        fecha_entrega: pedidoEditar.fecha_entrega,
        especificaciones: pedidoEditar.especificaciones,
        perfil_impresion: pedidoEditar.perfil_impresion,
        configuracion: pedidoEditar.configuracion,
        cliente_contacto: pedidoEditar.cliente_contacto,
        cantidad: parseInt(pedidoEditar.cantidad),
        descuento: parseInt(pedidoEditar.cantidad) > 10,
        letrero_tipo: esLetreroEditar
          ? pedidoEditar.letrero_tipo || null
          : null,
        letrero_alto: esLetreroEditar
          ? parseFloat(pedidoEditar.letrero_alto) || null
          : null,
        letrero_largo: esLetreroEditar
          ? parseFloat(pedidoEditar.letrero_largo) || null
          : null,
        precio_total: pedidoEditar.precio_total
          ? parseFloat(pedidoEditar.precio_total)
          : null,
        abono: pedidoEditar.abono ? parseFloat(pedidoEditar.abono) : 0,
      })
      .eq("id", pedidoEditar.id);

    if (!error) {
      await registrarBloque({
        entidad: "pedido",
        entidad_id: pedidoEditar.id,
        accion: "actualizado",
        usuario_id: usuario?.id,
        datosExtra: {
          cliente_nombre: pedidoEditar.cliente_nombre,
          estado: pedidoEditar.estado,
          prioridad: pedidoEditar.prioridad,
        },
      });
      setModalEditar(false);
      setPedidoEditar(null);
      setEsLetreroEditar(false);
      cargarPedidos();
      toast.success("Guardado exitosamente", {
        position: "bottom-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        theme: "dark",
        transition: Zoom,
      });
    } else {
      console.error(error.message);
    }
  };

  const verificarStock = async (materialId) => {
    if (!materialId) {
      setStockDisponible(null);
      return;
    }
    const { data } = await supabase
      .from("materiales")
      .select("stock, nombre, unidad, estado")
      .eq("id", materialId)
      .single();
    if (data) setStockDisponible(data);
  };

  // ─── DISEÑOS ────────────────────────────────────────────────────────

  const handleArchivoChange = (e) => {
    setArchivoDis(e.target.files[0] || null);
  };

  const subirDiseno = async () => {
    if (!pedidoIdDiseno || !archivoDis) return;
    setSubiendoArchivo(true);
    setErrorSubida("");

    const { data: userData } = await supabase.auth.getUser();
    const extension = archivoDis.name.split(".").pop();
    const nombreUnico = `${Date.now()}_${userData.user.id}.${extension}`;

    const { error: storageError } = await supabase.storage
      .from("disenos")
      .upload(nombreUnico, archivoDis);

    if (storageError) {
      setErrorSubida(`Error al subir archivo: ${storageError.message}`);
      setSubiendoArchivo(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("disenos")
      .getPublicUrl(nombreUnico);

    const { error: dbError } = await supabase.from("disenos").insert({
      pedido_id: pedidoIdDiseno,
      archivo_url: urlData.publicUrl,
      hash_archivo: nombreUnico,
    });

    if (dbError) {
      setErrorSubida(`Error al guardar en BD: ${dbError.message}`);
    } else {
      await supabase
        .from("pedidos")
        .update({ estado: "en_diseño" })
        .eq("id", pedidoIdDiseno);
      await registrarBloque({
        entidad: "diseno",
        entidad_id: pedidoIdDiseno,
        accion: "diseno_subido",
        usuario_id: userData.user.id,
        datosExtra: {
          archivo: archivoDis.name,
          pedido_id: pedidoIdDiseno,
        },
      });
      setMostrarModalDiseno(false);
      setPedidoIdDiseno("");
      setArchivoDis(null);
      setErrorSubida("");
      cargarDisenos();
      cargarPedidos();
      toast.success("Subido  exitosamente", {
        position: "bottom-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        theme: "dark",
        transition: Zoom,
      });
    }

    setSubiendoArchivo(false);
  };

const aprobarDiseno = async (diseno) => {
  await supabase
    .from("pedidos")
    .update({ estado: "en_impresion" })
    .eq("id", diseno.pedido_id)

  let txHash = null
  try {
    const { data, error } = await supabase.functions.invoke("registrar-blockchain", {
      body: {
        tipo_operacion: "aprobacion_diseño",
        datos: {
          diseno_id: diseno.id,
          pedido_id: diseno.pedido_id,
          hash_archivo: diseno.hash_archivo,
        },
      },
    })
    if (error) {
      console.error("Error registrando en blockchain:", error.message)
    } else {
      txHash = data.tx_hash
      console.log("✅ Registrado en blockchain. Tx hash:", txHash)
    }
  } catch (e) {
    console.error("Error llamando Edge Function blockchain:", e.message)
  }

  const { error: errHistorial } = await supabase.from("historial").insert({
    entidad: "diseno",
    entidad_id: diseno.id,
    accion: "aprobado",
    usuario_id: usuario?.id,
    datos: JSON.stringify({
      pedido_id: diseno.pedido_id,
      hash_archivo: diseno.hash_archivo,
    }),
    tx_hash_blockchain: txHash,
  })
  if (errHistorial) console.error("Error guardando historial:", errHistorial.message)

  cargarDisenos()
  cargarPedidos()
}

  const rechazarDiseno = async (diseno) => {
    const confirmar = window.confirm(
      "¿Rechazar este diseño? El pedido volverá a en_diseño.",
    );
    if (!confirmar) return;
    await supabase
      .from("pedidos")
      .update({ estado: "en_diseño" })
      .eq("id", diseno.pedido_id);

    await registrarBloque({
      entidad: "diseno",
      entidad_id: diseno.id,
      accion: "rechazado",
      usuario_id: usuario?.id,
      datosExtra: {
        pedido_id: diseno.pedido_id,
      },
    });
    cargarDisenos();
    cargarPedidos();
  };

  // ─── ACCIONES PEDIDOS ───────────────────────────────────────────────

  const eliminarPedido = async (pedido) => {
    const confirmar = window.confirm(
      `¿Estás seguro de que quieres eliminar el pedido de "${pedido.cliente_nombre}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmar) return;

    setProcesando(true);
    try {
      if (pedido.disenos && pedido.disenos.length > 0) {
        for (const diseno of pedido.disenos) {
          if (diseno.hash_archivo) {
            await supabase.storage
              .from("disenos")
              .remove([diseno.hash_archivo]);
          }
        }
      }
      const { error } = await supabase
        .from("pedidos")
        .delete()
        .eq("id", pedido.id);
      if (error) throw error;

      await registrarBloque({
        entidad: "pedido",
        entidad_id: pedido.id,
        accion: "eliminado",
        usuario_id: usuario?.id,
        datosExtra: {
          cliente_nombre: pedido.cliente_nombre,
        },
      });

      cargarPedidos();
    } catch (error) {
      console.error("Error al eliminar:", error.message);
      alert("No se pudo eliminar el pedido");
    } finally {
      setProcesando(false);
    }
  };

  const finalizarPedido = async (pedido) => {
    const confirmar = window.confirm(
      `¿Finalizar pedido de ${pedido.cliente_nombre}? Se borrarán los archivos de diseño.`,
    );
    if (!confirmar) return;

    setProcesando(true);
    try {
      const disenosVinc = pedido.disenos || [];
      for (const diseno of disenosVinc) {
        if (diseno.hash_archivo) {
          await supabase.storage.from("disenos").remove([diseno.hash_archivo]);
        }
      }

      const { error: errDiseno } = await supabase
        .from("disenos")
        .delete()
        .eq("pedido_id", pedido.id);
      if (errDiseno) throw errDiseno;

      const { error: errPedido } = await supabase
        .from("pedidos")
        .update({ estado: "terminado" })
        .eq("id", pedido.id);
      if (errPedido) throw errPedido;

      await registrarBloque({
        entidad: "pedido",
        entidad_id: pedido.id,
        accion: "terminado",
        usuario_id: usuario?.id,
        datosExtra: {
          cliente_nombre: pedido.cliente_nombre,
          cantidad: pedido.cantidad,
        },
      });

      cargarPedidos();
    } catch (e) {
      console.error("Error al finalizar pedido:", e.message);
      alert("Error: " + e.message);
    } finally {
      setProcesando(false);
    }
  };

  const abrirVerPedido = (pedido) => {
    setPedidoVer(pedido);
    setModalVerPedido(true);
  };

  // ─── HELPERS ────────────────────────────────────────────────────────

  const colorEstado = (estado) => {
    const colores = {
      pendiente: "#f59e0b",
      en_diseño: "#4f6ef7",
      en_impresion: "#8b5cf6",
      sin_material: "#ef4444",
      terminado: "#64748b",
    };
    return colores[estado] || "#ffffff";
  };

  const colorPrioridad = (prioridad) => {
    const colores = { alta: "#ef4444", media: "#f59e0b", baja: "#22c55e" };
    return colores[prioridad] || "#ffffff";
  };

  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

  // ─── RENDER ─────────────────────────────────────────────────────────

  return (
    <div className="dashboard">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>KRYPTON</h2>
          <span>Diseño</span>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${seccion === "inicio" ? "active" : ""}`}
            onClick={() => setSeccion("inicio")}
          >
            Inicio
          </button>
          <button
            className={`nav-item ${seccion === "pedidos" ? "active" : ""}`}
            onClick={() => setSeccion("pedidos")}
          >
            Pedidos
          </button>
          <button
            className={`nav-item ${seccion === "disenos" ? "active" : ""}`}
            onClick={() => setSeccion("disenos")}
          >
            Diseños
          </button>
          <button
            className={`nav-item ${seccion === "calculadora" ? "active" : ""}`}
            onClick={() => setSeccion("calculadora")}
          >
            Calculadora
          </button>
          <button
            className={`nav-item ${seccion === "contabilidad" ? "active" : ""}`}
            onClick={() => setSeccion("contabilidad")}
          >
            Contabilidad
          </button>

          <button
            className={`nav-item ${seccion === "blockchain" ? "active" : ""}`}
            onClick={() => setSeccion("blockchain")}
          >
            🔗 Blockchain
          </button>
        </nav>
        <button className="sidebar-logout" onClick={cambiarsesion}>
          Cambiar sesión
        </button>
        <button className="sidebar-logout" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>
            {seccion === "inicio"
              ? "Inicio"
              : seccion === "pedidos"
                ? "Pedidos"
                : seccion === "disenos"
                  ? "Diseños"
                  : seccion === "contabilidad"
                    ? "Contabilidad"

                      : seccion === "blockchain"
                        ? "Blockchain"
                        : "Calculadora"}
          </h1>
          {seccion === "pedidos" && (
            <button className="btn-nuevo" onClick={() => setMostrarModal(true)}>
              + Nuevo Pedido
            </button>
          )}
          {seccion === "disenos" && (
            <button
              className="btn-nuevo"
              onClick={() => setMostrarModalDiseno(true)}
            >
              + Subir Diseño
            </button>
          )}
          <div
            className="dashboard-avatar"
            onClick={() => setMostrarPerfil(true)}
            title={perfil?.usuario ? `@${perfil.usuario}` : "Perfil"}
          >
            {perfil?.usuario ? perfil.usuario.slice(0, 2).toUpperCase() : "??"}
          </div>
        </header>

        <div className="dashboard-content">
          {/* SECCIÓN PEDIDOS */}

          {seccion === "inicio" && (
            <HomeDashboard usuario={usuario} rol="diseñador" />
          )}

          {seccion === "pedidos" && (
            <div className="seccion">
              {cargando ? (
                <p className="texto-secondary">Cargando pedidos...</p>
              ) : pedidos.length === 0 ? (
                <p className="texto-secondary">
                  No hay pedidos registrados aún.
                </p>
              ) : (
                <div className="tabla-wrapper">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Contacto</th>
                        <th>Estado</th>
                        <th>Prioridad</th>
                        <th>Cantidad</th>
                        <th>Descuento</th>
                        <th>Perfil</th>
                        <th>Configuración</th>
                        <th>Entrega</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidos.map((pedido) => (
                        <tr key={pedido.id}>
                          <td>{pedido.cliente_nombre || "—"}</td>
                          <td>{pedido.cliente_contacto || "—"}</td>
                          <td>
                            <span
                              className="badge"
                              style={{ background: colorEstado(pedido.estado) }}
                            >
                              {pedido.estado}
                            </span>
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: colorPrioridad(pedido.prioridad),
                              }}
                            >
                              {pedido.prioridad}
                            </span>
                          </td>
                          <td>{pedido.cantidad}</td>
                          <td>{pedido.descuento ? "✅ Sí" : "—"}</td>
                          <td>{pedido.perfil_impresion || "—"}</td>
                          <td>{pedido.configuracion || "—"}</td>
                          <td>{pedido.fecha_entrega || "—"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                className="btn-accion"
                                onClick={() => abrirVerPedido(pedido)}
                              >
                                Ver
                              </button>
                              <button
                                className="btn-accion"
                                onClick={() => abrirEditar(pedido)}
                              >
                                Editar
                              </button>
                              <button
                                className="btn-eliminar"
                                onClick={() => eliminarPedido(pedido)}
                                disabled={procesando}
                              >
                                {procesando ? "..." : "Eliminar"}
                              </button>
                              <button
                                className="btn-finalizar"
                                onClick={() => finalizarPedido(pedido)}
                                disabled={procesando}
                              >
                                {procesando ? "..." : "Fin"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN DISEÑOS */}
          {seccion === "disenos" && (
            <div className="seccion">
              {disenos.length === 0 ? (
                <p className="texto-secondary">No hay diseños subidos aún.</p>
              ) : (
                <div className="tabla-wrapper">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Estado del pedido</th>
                        <th>Fecha</th>
                        <th>Archivo</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disenos.map((d) => (
                        <tr key={d.id}>
                          <td>{d.pedidos?.cliente_nombre || "—"}</td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: colorEstado(d.pedidos?.estado),
                              }}
                            >
                              {d.pedidos?.estado || "—"}
                            </span>
                          </td>
                          <td>
                            {new Date(d.created_at).toLocaleDateString("es-EC")}
                          </td>
                          <td>
                            <a
                              href={d.archivo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-accion"
                            >
                              Ver archivo
                            </a>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              {d.pedidos?.estado === "en_diseño" && (
                                <>
                                  <button
                                    className="btn-accion"
                                    onClick={() => aprobarDiseno(d)}
                                  >
                                    Aprobar
                                  </button>
                                  <button
                                    className="btn-eliminar"
                                    onClick={() => rechazarDiseno(d)}
                                  >
                                    Rechazar
                                  </button>
                                </>
                              )}
                              {d.pedidos?.estado === "en_impresion" && (
                                <span
                                  style={{ fontSize: "12px", color: "#8b5cf6" }}
                                >
                                  ✅ En impresión
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {seccion === "calculadora" && <Calculadora usuario={usuario} />}
          {seccion === "contabilidad" && <Contabilidad usuario={usuario} />}
          {seccion === "blockchain" && <BlockchainViewer />}
        </div>
      </main>

      {/* ── MODAL NUEVO PEDIDO ────────────────────────────────────── */}
      {mostrarModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Nuevo Pedido</h3>
            <div className="modal-grid">
              <div className="modal-field">
                <label>Nombre del cliente</label>
                <input
                  type="text"
                  name="cliente_nombre"
                  placeholder="Ej: Juan Pérez"
                  value={nuevoPedido.cliente_nombre}
                  onChange={handleChangePedido}
                />
              </div>

              <div className="modal-field">
                <label>Contacto</label>
                <input
                  type="text"
                  name="cliente_contacto"
                  placeholder="Teléfono o correo"
                  value={nuevoPedido.cliente_contacto}
                  onChange={handleChangePedido}
                />
              </div>

              <div className="modal-field">
                <label>Cantidad</label>
                <input
                  type="number"
                  name="cantidad"
                  min="1"
                  value={nuevoPedido.cantidad}
                  onChange={handleChangePedido}
                />
                {nuevoPedido.descuento && (
                  <span className="descuento-aviso">
                    ✅ Aplica descuento por volumen
                  </span>
                )}
              </div>

              <div className="modal-field">
                <label>Prioridad</label>
                <select
                  name="prioridad"
                  value={nuevoPedido.prioridad}
                  onChange={handleChangePedido}
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Precio del pedido ($)</label>
                <input
                  type="number"
                  name="precio_total"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={nuevoPedido.precio_total}
                  onChange={handleChangePedido}
                />
              </div>

              <div className="modal-field">
                <label>Abono del cliente ($)</label>
                <input
                  type="number"
                  name="abono"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={nuevoPedido.abono}
                  onChange={handleChangePedido}
                />
                {nuevoPedido.precio_total && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#f59e0b",
                      marginTop: "4px",
                      display: "block",
                    }}
                  >
                    Saldo pendiente: $
                    {(
                      parseFloat(nuevoPedido.precio_total || 0) -
                      parseFloat(nuevoPedido.abono || 0)
                    ).toFixed(2)}
                  </span>
                )}
              </div>

              <div className="modal-field modal-field-full">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="esLetrero"
                    checked={nuevoPedido.esLetrero}
                    onChange={handleChangePedido}
                  />
                  ¿Es letrero?
                </label>
              </div>

              {!nuevoPedido.esLetrero && (
                <div className="modal-field modal-field-full">
                  <label>Material</label>
                  <select
                    name="material_id"
                    value={nuevoPedido.material_id || ""}
                    onChange={handleChangePedido}
                  >
                    <option value="">Seleccionar material...</option>
                    {materiales.map((mat) => (
                      <option key={mat.id} value={mat.id}>
                        {mat.nombre} {mat.subtipo ? `(${mat.subtipo})` : ""} —
                        Stock: {mat.stock} {mat.unidad}
                      </option>
                    ))}
                  </select>
                  {stockDisponible && stockDisponible.stock > 0 && (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#22c55e",
                        marginTop: "4px",
                      }}
                    >
                      ✅ Stock disponible: {stockDisponible.stock}{" "}
                      {stockDisponible.unidad}
                    </span>
                  )}
                  {stockDisponible && stockDisponible.stock === 0 && (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#ef4444",
                        marginTop: "4px",
                      }}
                    >
                      ⚠️ Sin stock. El pedido se registrará como "sin_material"
                    </span>
                  )}
                </div>
              )}

              {nuevoPedido.esLetrero && (
                <>
                  <div className="modal-field">
                    <label>Tipo de letrero</label>
                    <select
                      name="letrero_tipo"
                      value={nuevoPedido.letrero_tipo}
                      onChange={handleChangePedido}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="luminoso">Luminoso</option>
                      <option value="no_luminoso">No luminoso</option>
                      <option value="Madera">Madera</option>
                      <option value="Metal">Metal</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div className="modal-field">
                    <label>Alto (cm)</label>
                    <input
                      type="number"
                      name="letrero_alto"
                      min="0"
                      placeholder="ej: 60"
                      value={nuevoPedido.letrero_alto}
                      onChange={handleChangePedido}
                    />
                  </div>
                  <div className="modal-field">
                    <label>Largo (cm)</label>
                    <input
                      type="number"
                      name="letrero_largo"
                      min="0"
                      placeholder="ej: 120"
                      value={nuevoPedido.letrero_largo}
                      onChange={handleChangePedido}
                    />
                  </div>
                </>
              )}

              <div className="modal-field">
                <label>Configuración</label>
                <select
                  name="configuracion"
                  value={nuevoPedido.configuracion}
                  onChange={handleChangePedido}
                >
                  <option value="">Seleccionar...</option>
                  <option value="BIDI">BIDI</option>
                  <option value="ONE WAY">ONE WAY</option>
                  <option value="otra">Otra</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Fecha de entrega</label>
                <input
                  type="date"
                  name="fecha_entrega"
                  value={nuevoPedido.fecha_entrega}
                  onChange={handleChangePedido}
                />
              </div>

              <div className="modal-field modal-field-full">
                <label>Especificaciones</label>
                <textarea
                  name="especificaciones"
                  placeholder="Detalles del trabajo..."
                  value={nuevoPedido.especificaciones}
                  onChange={handleChangePedido}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-buttons">
              <button onClick={agregarPedido} className="btn-guardar">
                Guardar
              </button>
              <button
                onClick={() => {
                  setMostrarModal(false);
                  setNuevoPedido(pedidoInicial);
                  setStockDisponible(null);
                }}
                className="btn-cancelar"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR PEDIDO ───────────────────────────────────── */}
      {modalEditar && pedidoEditar && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Editar Pedido — {pedidoEditar.cliente_nombre}</h3>
            <div className="modal-grid">
              <div className="modal-field">
                <label>Estado</label>
                <select
                  name="estado"
                  value={pedidoEditar.estado}
                  onChange={handleChangeEditar}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_diseño">En diseño</option>
                  <option value="en_impresion">En impresión</option>
                  <option value="terminado">Terminado</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Prioridad</label>
                <select
                  name="prioridad"
                  value={pedidoEditar.prioridad}
                  onChange={handleChangeEditar}
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Contacto cliente</label>
                <input
                  type="text"
                  name="cliente_contacto"
                  value={pedidoEditar.cliente_contacto || ""}
                  onChange={handleChangeEditar}
                />
              </div>

              <div className="modal-field">
                <label>Cantidad</label>
                <input
                  type="number"
                  name="cantidad"
                  min="1"
                  value={pedidoEditar.cantidad || 1}
                  onChange={handleChangeEditar}
                />
                {parseInt(pedidoEditar.cantidad) > 10 && (
                  <span className="descuento-aviso">
                    ✅ Aplica descuento por volumen
                  </span>
                )}
              </div>

              <div className="modal-field">
                <label>Precio del pedido ($)</label>
                <input
                  type="number"
                  name="precio_total"
                  min="0"
                  step="0.01"
                  value={pedidoEditar.precio_total || ""}
                  onChange={handleChangeEditar}
                />
              </div>

              <div className="modal-field">
                <label>Abono del cliente ($)</label>
                <input
                  type="number"
                  name="abono"
                  min="0"
                  step="0.01"
                  value={pedidoEditar.abono || ""}
                  onChange={handleChangeEditar}
                />
                {pedidoEditar.precio_total && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#f59e0b",
                      marginTop: "4px",
                      display: "block",
                    }}
                  >
                    Saldo pendiente: $
                    {(
                      parseFloat(pedidoEditar.precio_total || 0) -
                      parseFloat(pedidoEditar.abono || 0)
                    ).toFixed(2)}
                  </span>
                )}
              </div>

              <div className="modal-field">
                <label>Perfil de impresión</label>
                <input
                  type="text"
                  name="perfil_impresion"
                  value={pedidoEditar.perfil_impresion || ""}
                  onChange={handleChangeEditar}
                />
              </div>

              <div className="modal-field">
                <label>Configuración</label>
                <select
                  name="configuracion"
                  value={pedidoEditar.configuracion || ""}
                  onChange={handleChangeEditar}
                >
                  <option value="">Seleccionar...</option>
                  <option value="BIDI">BIDI</option>
                  <option value="ONE WAY">ONE WAY</option>
                  <option value="otra">Otra</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Fecha de entrega</label>
                <input
                  type="date"
                  name="fecha_entrega"
                  value={pedidoEditar.fecha_entrega || ""}
                  onChange={handleChangeEditar}
                />
              </div>

              <div className="modal-field modal-field-full">
                <label>Especificaciones</label>
                <textarea
                  name="especificaciones"
                  value={pedidoEditar.especificaciones || ""}
                  onChange={handleChangeEditar}
                  rows={3}
                />
              </div>

              <div className="modal-field modal-field-full">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={esLetreroEditar}
                    onChange={(e) => {
                      setEsLetreroEditar(e.target.checked);
                      if (!e.target.checked)
                        setPedidoEditar({
                          ...pedidoEditar,
                          letrero_tipo: "",
                          letrero_alto: "",
                          letrero_largo: "",
                        });
                    }}
                  />
                  ¿Es letrero?
                </label>
              </div>

              {esLetreroEditar && (
                <>
                  <div className="modal-field">
                    <label>Tipo de letrero</label>
                    <select
                      name="letrero_tipo"
                      value={pedidoEditar.letrero_tipo || ""}
                      onChange={handleChangeEditar}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="luminoso">Luminoso</option>
                      <option value="no_luminoso">No luminoso</option>
                      <option value="Madera">Madera</option>
                      <option value="Metal">Metal</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div className="modal-field">
                    <label>Alto (cm)</label>
                    <input
                      type="number"
                      name="letrero_alto"
                      min="0"
                      value={pedidoEditar.letrero_alto || ""}
                      onChange={handleChangeEditar}
                    />
                  </div>
                  <div className="modal-field">
                    <label>Largo (cm)</label>
                    <input
                      type="number"
                      name="letrero_largo"
                      min="0"
                      value={pedidoEditar.letrero_largo || ""}
                      onChange={handleChangeEditar}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-buttons">
              <button onClick={guardarEdicion} className="btn-guardar">
                Guardar cambios
              </button>
              <button
                onClick={() => {
                  setModalEditar(false);
                  setPedidoEditar(null);
                  setEsLetreroEditar(false);
                }}
                className="btn-cancelar"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL VER PEDIDO ─────────────────────────────────────── */}
      {modalVerPedido && pedidoVer && (
        <div className="modal-overlay" onClick={() => setModalVerPedido(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Detalles: {pedidoVer.cliente_nombre}</h3>
            <div className="modal-grid">
              <div className="modal-field">
                <label>Estado</label>
                <p>{pedidoVer.estado}</p>
              </div>
              <div className="modal-field">
                <label>Prioridad</label>
                <p>{pedidoVer.prioridad}</p>
              </div>
              <div className="modal-field">
                <label>Cantidad</label>
                <p>{pedidoVer.cantidad}</p>
              </div>
              <div className="modal-field">
                <label>Contacto</label>
                <p>{pedidoVer.cliente_contacto || "Sin contacto"}</p>
              </div>
              <div className="modal-field">
                <label>Entrega</label>
                <p>{pedidoVer.fecha_entrega || "No definida"}</p>
              </div>

              {/* PRECIO / ABONO / SALDO */}
              {pedidoVer.precio_total != null && (
                <>
                  <div className="modal-field">
                    <label>Precio total</label>
                    <p
                      style={{
                        color: "#22c55e",
                        fontWeight: 700,
                        fontSize: "16px",
                      }}
                    >
                      {fmt(pedidoVer.precio_total)}
                    </p>
                  </div>
                  <div className="modal-field">
                    <label>Abono</label>
                    <p style={{ color: "#4f6ef7", fontWeight: 600 }}>
                      {fmt(pedidoVer.abono)}
                    </p>
                  </div>
                  <div className="modal-field">
                    <label>Saldo pendiente</label>
                    <p
                      style={{
                        color: pedidoVer.saldo > 0 ? "#f59e0b" : "#22c55e",
                        fontWeight: 700,
                      }}
                    >
                      {fmt(pedidoVer.saldo)}
                      {pedidoVer.saldo <= 0 && " ✅ Pagado"}
                    </p>
                  </div>
                </>
              )}

              {pedidoVer.letrero_tipo && (
                <>
                  <div className="modal-field">
                    <label>Tipo de letrero</label>
                    <p>{pedidoVer.letrero_tipo}</p>
                  </div>
                  <div className="modal-field">
                    <label>Dimensiones</label>
                    <p>
                      {pedidoVer.letrero_alto ?? "?"} ×{" "}
                      {pedidoVer.letrero_largo ?? "?"} cm
                    </p>
                  </div>
                </>
              )}

              <div className="modal-field modal-field-full">
                <label>Especificaciones</label>
                <p>{pedidoVer.especificaciones || "Sin especificaciones"}</p>
              </div>
            </div>
            <div className="modal-buttons">
              <button
                className="btn-cancelar"
                onClick={() => setModalVerPedido(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SUBIR DISEÑO ────────────────────────────────────── */}
      {mostrarModalDiseno && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Subir Diseño</h3>
            <div className="modal-grid">
              <div className="modal-field modal-field-full">
                <label>Pedido asociado</label>
                <select
                  value={pedidoIdDiseno}
                  onChange={(e) => setPedidoIdDiseno(e.target.value)}
                >
                  <option value="">Seleccionar pedido...</option>
                  {pedidos
                    .filter((p) =>
                      ["pendiente", "en_diseño", "sin_material"].includes(
                        p.estado,
                      ),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.cliente_nombre} — {p.estado}
                      </option>
                    ))}
                </select>
              </div>

              <div className="modal-field modal-field-full">
                <label>Archivo del diseño</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,.ai,.psd,.svg"
                  onChange={handleArchivoChange}
                  className="input-file"
                />
                {archivoDis && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#22c55e",
                      marginTop: "4px",
                    }}
                  >
                    ✅ {archivoDis.name}
                  </span>
                )}
              </div>
            </div>
            {errorSubida && (
              <p
                style={{
                  fontSize: "12px",
                  color: "#ef4444",
                  marginBottom: "12px",
                }}
              >
                ⚠️ {errorSubida}
              </p>
            )}
            <div className="modal-buttons">
              <button
                onClick={subirDiseno}
                className="btn-guardar"
                disabled={subiendoArchivo || !pedidoIdDiseno || !archivoDis}
              >
                {subiendoArchivo ? "Subiendo..." : "Subir diseño"}
              </button>
              <button
                onClick={() => {
                  setMostrarModalDiseno(false);
                  setPedidoIdDiseno("");
                  setArchivoDis(null);
                  setErrorSubida("");
                }}
                className="btn-cancelar"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        transition={Zoom}
      />
      {mostrarPerfil && (
        <PerfilModal
          usuario={usuario}
          perfil={perfil}
          onClose={() => setMostrarPerfil(false)}
          onUsuarioActualizado={(nuevoUsuario) => {
            setPerfil((prev) => ({ ...prev, usuario: nuevoUsuario }));
          }}
        />
      )}
      <ChatbotWidget usuario={usuario} rol="diseñador" />
    </div>
  );
};

export default DashboardDisenador;
