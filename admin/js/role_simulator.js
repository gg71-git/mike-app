document.addEventListener("DOMContentLoaded", () => {
  const roles = ["admin", "kunde_admin", "agent", "kunde_user"];
  const currentRole = document.body.dataset.currentRole;
  if (!currentRole) return;

  const bar = document.createElement("div");
  bar.classList.add("role-bar");

  roles.forEach(r => {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "role_sim";
    radio.value = r;
    if (currentRole === r) radio.checked = true;

    radio.addEventListener("change", () => {
      window.location.href = `../includes/set_role.php?role=${r}`;
    });

    label.appendChild(radio);
    label.append(" " + r);
    bar.appendChild(label);
  });

  // Vor dem ersten .admin-container.filter einfügen
const wrapper = document.querySelector(".page-wrapper");
if (wrapper) {
  wrapper.insertAdjacentElement("afterbegin", bar);
} else {
  document.body.prepend(bar);
}


});
