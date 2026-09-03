export function AntiSpamField() {
  return <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
    <label>Оставьте это поле пустым<input name="website_url" type="text" tabIndex={-1} autoComplete="off" /></label>
  </div>;
}
