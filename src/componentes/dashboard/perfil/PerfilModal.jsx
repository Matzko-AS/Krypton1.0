import { useState } from "react";
import { supabase } from "../../../supabase/supabaseClient";
import "./PerfilModal.css";

const PerfilModal = ({ usuario, perfil, onClose, onUsuarioActualizado }) => {
  const [tab, setTab] = useState("usuario");
  // ── Estado cambio de rol ──
  const [nuevoRol, setNuevoRol] = useState("");
  const [guardandoRol, setGuardandoRol] = useState(false);
  const [errorRol, setErrorRol] = useState("");
  const [okRol, setOkRol] = useState("");

  // ── Estado cambio usuario ──
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [checkingUsuario, setCheckingUsuario] = useState(false);
  const [usuarioDisponible, setUsuarioDisponible] = useState(null);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [errorUsuario, setErrorUsuario] = useState("");
  const [okUsuario, setOkUsuario] = useState("");

  // ── Estado cambio contraseña ──
  const [passActual, setPassActual] = useState("");
  const [passNueva, setPassNueva] = useState("");
  const [passConfirmar, setPassConfirmar] = useState("");
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [errorPass, setErrorPass] = useState("");
  const [okPass, setOkPass] = useState("");
  const [verActual, setVerActual] = useState(false);
  const [verNueva, setVerNueva] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);

  const iniciales = perfil?.usuario
    ? perfil.usuario.slice(0, 2).toUpperCase()
    : "??";

  // ── Verificar disponibilidad de usuario ──
  const verificarUsuario = async (valor) => {
    setNuevoUsuario(valor);
    setErrorUsuario("");
    setOkUsuario("");
    setUsuarioDisponible(null);

    if (!valor || valor.length < 3) return;
    if (valor === perfil?.usuario) {
      setErrorUsuario("Es el mismo usuario actual.");
      return;
    }

    setCheckingUsuario(true);
    const { data } = await supabase
      .from("usuarios")
      .select("id")
      .eq("usuario", valor.toLowerCase())
      .maybeSingle();

    setUsuarioDisponible(!data);
    setCheckingUsuario(false);
  };

  // ── Guardar nuevo usuario ──
  const handleGuardarUsuario = async () => {
    setErrorUsuario("");
    setOkUsuario("");

    if (!nuevoUsuario || nuevoUsuario.length < 3)
      return setErrorUsuario("El usuario debe tener al menos 3 caracteres.");
    if (!usuarioDisponible)
      return setErrorUsuario("Ese usuario no está disponible.");

    setGuardandoUsuario(true);

    const { error } = await supabase
      .from("usuarios")
      .update({ usuario: nuevoUsuario.toLowerCase() })
      .eq("id", usuario?.id);

    if (error) {
      setErrorUsuario("Error al actualizar: " + error.message);
    } else {
      setOkUsuario("¡Usuario actualizado correctamente!");
      setNuevoUsuario("");
      setUsuarioDisponible(null);
      if (onUsuarioActualizado)
        onUsuarioActualizado(nuevoUsuario.toLowerCase());
    }

    setGuardandoUsuario(false);
  };

  // ── Guardar nuevo rol ──
const handleGuardarRol = async () => {
  setErrorRol("");
  setOkRol("");

  if (!nuevoRol) return setErrorRol("Selecciona un rol.");
  if (nuevoRol === perfil?.rol) return setErrorRol("Ya tienes ese rol actualmente.");
  if (!["empleado", "diseñador"].includes(nuevoRol))
    return setErrorRol("Rol no válido.");

  setGuardandoRol(true);

  // .select() devuelve las filas realmente actualizadas
  const { data, error } = await supabase
    .from("usuarios")
    .update({ rol: nuevoRol })
    .eq("id", usuario?.id)
    .select("id, rol");

  if (error) {
    setErrorRol("Error al actualizar el rol: " + error.message);
  } else if (!data || data.length === 0) {
    // RLS bloqueó el update en silencio
    setErrorRol("No se pudo cambiar el rol (permisos de la base de datos).");
  } else {
    setOkRol("¡Rol actualizado correctamente!");
    const rolFinal = data[0].rol;
    setNuevoRol("");
    setTimeout(() => {
      window.location.href =
        rolFinal === "diseñador" ? "/dashboard/diseñador" : "/dashboard/empleado";
    }, 800);
  }

  setGuardandoRol(false);
};

  // ── Guardar nueva contraseña ──
  const handleGuardarPassword = async () => {
    setErrorPass("");
    setOkPass("");

    if (!passActual) return setErrorPass("Ingresa tu contraseña actual.");
    if (!passNueva || passNueva.length < 6)
      return setErrorPass(
        "La nueva contraseña debe tener al menos 6 caracteres.",
      );
    if (passNueva !== passConfirmar)
      return setErrorPass("Las contraseñas nuevas no coinciden.");
    if (passActual === passNueva)
      return setErrorPass(
        "La nueva contraseña debe ser diferente a la actual.",
      );

    setGuardandoPass(true);

    // Verificar contraseña actual re-autenticando
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: usuario?.email,
      password: passActual,
    });

    if (signInError) {
      setErrorPass("La contraseña actual es incorrecta.");
      setGuardandoPass(false);
      return;
    }

    // Actualizar contraseña
    const { error: updateError } = await supabase.auth.updateUser({
      password: passNueva,
    });

    if (updateError) {
      setErrorPass("Error al actualizar: " + updateError.message);
    } else {
      setOkPass("¡Contraseña actualizada correctamente!");
      setPassActual("");
      setPassNueva("");
      setPassConfirmar("");
    }

    setGuardandoPass(false);
  };

  return (
    <div className="perfil-overlay" onClick={onClose}>
      <div className="perfil-modal" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="perfil-header">
          <div className="perfil-avatar-lg">{iniciales}</div>
          <div>
            <p className="perfil-nombre">{perfil?.nombre || "—"}</p>
            <p className="perfil-usuario-actual">@{perfil?.usuario || "—"}</p>
            <span className="perfil-rol-badge">{perfil?.rol || "—"}</span>
          </div>
          <button className="perfil-close" onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* TABS */}
        <div className="perfil-tabs">
          <button
            className={`perfil-tab ${tab === "usuario" ? "active" : ""}`}
            onClick={() => {
              setTab("usuario");
              setErrorUsuario("");
              setOkUsuario("");
            }}
          >
            <i className="ti ti-user" /> Cambiar usuario
          </button>
          <button
            className={`perfil-tab ${tab === "rol" ? "active" : ""}`}
            onClick={() => {
              setTab("rol");
              setErrorRol("");
              setOkRol("");
              setNuevoRol("");
            }}
          >
            <i className="ti ti-switch-2" /> Cambiar rol
          </button>
          <button
            className={`perfil-tab ${tab === "password" ? "active" : ""}`}
            onClick={() => {
              setTab("password");
              setErrorPass("");
              setOkPass("");
            }}
          >
            <i className="ti ti-lock" /> Cambiar contraseña
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="perfil-body">
          {/* ── TAB USUARIO ── */}
          {tab === "usuario" && (
            <div className="perfil-form">
              <p className="perfil-hint">
                Usuario actual: <strong>@{perfil?.usuario}</strong>
              </p>

              <div className="perfil-field">
                <label className="perfil-label">Nuevo usuario</label>
                <div className="perfil-input-wrap">
                  <input
                    type="text"
                    className="perfil-input"
                    placeholder="ej: jperez"
                    value={nuevoUsuario}
                    onChange={(e) => verificarUsuario(e.target.value)}
                    maxLength={30}
                  />
                  <span className="perfil-input-status">
                    {checkingUsuario && <i className="ti ti-loader-2 spin" />}
                    {!checkingUsuario && usuarioDisponible === true && (
                      <i
                        className="ti ti-circle-check"
                        style={{ color: "#22c55e" }}
                      />
                    )}
                    {!checkingUsuario && usuarioDisponible === false && (
                      <i
                        className="ti ti-circle-x"
                        style={{ color: "#ef4444" }}
                      />
                    )}
                  </span>
                </div>
                {usuarioDisponible === true && (
                  <p className="perfil-ok-inline">✓ Disponible</p>
                )}
                {usuarioDisponible === false && (
                  <p className="perfil-err-inline">✗ No disponible</p>
                )}
              </div>

              {errorUsuario && <p className="perfil-error">{errorUsuario}</p>}
              {okUsuario && <p className="perfil-success">{okUsuario}</p>}

              <button
                className="perfil-btn-guardar"
                onClick={handleGuardarUsuario}
                disabled={guardandoUsuario || !usuarioDisponible}
              >
                {guardandoUsuario ? "Guardando..." : "Guardar usuario"}
              </button>
            </div>
          )}

          {tab === "rol" && (
            <div className="perfil-form">
              <p className="perfil-hint">
                Rol actual: <strong>{perfil?.rol}</strong>
              </p>

              <div className="perfil-field">
                <label className="perfil-label">Nuevo rol</label>

                <select
                  className="perfil-input"
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value)}
                >
                  <option value="">Selecciona un rol</option>
                  <option value="empleado">Empleado</option>
                  <option value="diseñador">Diseñador</option>
                </select>
              </div>

              {errorRol && <p className="perfil-error">{errorRol}</p>}

              {okRol && <p className="perfil-success">{okRol}</p>}

              <button
                className="perfil-btn-guardar"
                onClick={handleGuardarRol}
                disabled={guardandoRol || !nuevoRol}
              >
                {guardandoRol ? "Guardando..." : "Cambiar rol"}
              </button>
            </div>
          )}

          {/* ── TAB CONTRASEÑA ── */}
          {tab === "password" && (
            <div className="perfil-form">
              <div className="perfil-field">
                <label className="perfil-label">Contraseña actual</label>
                <div className="perfil-input-wrap">
                  <input
                    type={verActual ? "text" : "password"}
                    className="perfil-input"
                    placeholder="Tu contraseña actual"
                    value={passActual}
                    onChange={(e) => setPassActual(e.target.value)}
                  />
                  <button
                    className="perfil-eye"
                    onClick={() => setVerActual(!verActual)}
                    type="button"
                  >
                    <i
                      className={`ti ${verActual ? "ti-eye-off" : "ti-eye"}`}
                    />
                  </button>
                </div>
              </div>

              <div className="perfil-field">
                <label className="perfil-label">Nueva contraseña</label>
                <div className="perfil-input-wrap">
                  <input
                    type={verNueva ? "text" : "password"}
                    className="perfil-input"
                    placeholder="Mínimo 6 caracteres"
                    value={passNueva}
                    onChange={(e) => setPassNueva(e.target.value)}
                  />
                  <button
                    className="perfil-eye"
                    onClick={() => setVerNueva(!verNueva)}
                    type="button"
                  >
                    <i className={`ti ${verNueva ? "ti-eye-off" : "ti-eye"}`} />
                  </button>
                </div>
                {passNueva.length > 0 && (
                  <div className="perfil-strength">
                    <div
                      className="perfil-strength-bar"
                      style={{
                        width:
                          passNueva.length >= 10
                            ? "100%"
                            : passNueva.length >= 6
                              ? "60%"
                              : "30%",
                        background:
                          passNueva.length >= 10
                            ? "#22c55e"
                            : passNueva.length >= 6
                              ? "#f59e0b"
                              : "#ef4444",
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="perfil-field">
                <label className="perfil-label">
                  Confirmar nueva contraseña
                </label>
                <div className="perfil-input-wrap">
                  <input
                    type={verConfirmar ? "text" : "password"}
                    className="perfil-input"
                    placeholder="Repite la nueva contraseña"
                    value={passConfirmar}
                    onChange={(e) => setPassConfirmar(e.target.value)}
                  />
                  <button
                    className="perfil-eye"
                    onClick={() => setVerConfirmar(!verConfirmar)}
                    type="button"
                  >
                    <i
                      className={`ti ${verConfirmar ? "ti-eye-off" : "ti-eye"}`}
                    />
                  </button>
                </div>
                {passConfirmar.length > 0 && passNueva !== passConfirmar && (
                  <p className="perfil-err-inline">
                    Las contraseñas no coinciden
                  </p>
                )}
                {passConfirmar.length > 0 && passNueva === passConfirmar && (
                  <p className="perfil-ok-inline">✓ Coinciden</p>
                )}
              </div>

              {errorPass && <p className="perfil-error">{errorPass}</p>}
              {okPass && <p className="perfil-success">{okPass}</p>}

              <button
                className="perfil-btn-guardar"
                onClick={handleGuardarPassword}
                disabled={guardandoPass}
              >
                {guardandoPass ? "Verificando..." : "Cambiar contraseña"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerfilModal;
