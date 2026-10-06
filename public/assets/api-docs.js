const spec = await (await fetch("openapi.json")).json(),
  host = document.querySelector("#operations");
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    const section = document.createElement("section");
    section.className = "panel spacer";
    const title = document.createElement("h3");
    title.textContent = method.toUpperCase() + " " + path;
    const text = document.createElement("p");
    text.textContent = op.summary;
    section.append(title, text);
    const schema = op.requestBody?.content?.["application/json"]?.schema;
    if (schema) {
      const details = document.createElement("details"),
        summary = document.createElement("summary"),
        pre = document.createElement("pre");
      summary.textContent = "Поля запроса";
      pre.textContent = JSON.stringify(schema, null, 2);
      pre.style.cssText = "white-space:pre-wrap;font-size:12px";
      details.append(summary, pre);
      section.append(details);
    }
    host.append(section);
  }
}
