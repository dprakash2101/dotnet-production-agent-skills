// Interactive Application Logic for .NET Production Agent Skills Docs
// Author: Devi Prakash (https://github.com/dprakash2101)

document.addEventListener("DOMContentLoaded", () => {
  const skills = window.SKILLS_DATA || [];
  let currentCategory = "all";
  let searchQuery = "";

  // DOM Elements
  const skillsGrid = document.getElementById("skills-grid");
  const searchInput = document.getElementById("search-input");
  const categoryPills = document.getElementById("category-pills");
  const skillsCountEl = document.getElementById("skills-count");
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalTitle = document.getElementById("modal-title");
  const modalCategory = document.getElementById("modal-category");
  const modalDesc = document.getElementById("modal-desc");
  const modalTrigger = document.getElementById("modal-trigger");
  const modalReferences = document.getElementById("modal-references");
  const modalPrompt = document.getElementById("modal-prompt");
  const copyPromptBtn = document.getElementById("copy-prompt-btn");
  const toast = document.getElementById("toast");
  const heroSkillCount = document.getElementById("hero-skill-count");
  const heroMetaCount = document.getElementById("hero-meta-count");

  // CLI Generator DOM Elements
  const hostSelect = document.getElementById("target-select");
  const scopeInputs = document.querySelectorAll('input[name="scope"]');
  const modeInputs = document.querySelectorAll('input[name="mode"]');
  const terminalCmd = document.getElementById("generated-cmd");
  const copyCmdBtn = document.getElementById("copy-cmd-btn");

  // Theme Management
  const initTheme = () => {
    const savedTheme = localStorage.getItem("theme");
    const theme = savedTheme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeButton(theme);
  };

  const updateThemeButton = (theme) => {
    if (themeToggleBtn) {
      const isDark = theme === "dark";
      themeToggleBtn.innerHTML = isDark
        ? `<span class="theme-toggle-icon" aria-hidden="true">☀</span><span class="theme-toggle-label">Light</span>`
        : `<span class="theme-toggle-icon" aria-hidden="true">☾</span><span class="theme-toggle-label">Dark</span>`;
      themeToggleBtn.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
      themeToggleBtn.setAttribute("aria-pressed", String(isDark));
      themeToggleBtn.title = `Switch to ${isDark ? "light" : "dark"} theme`;
    }
  };

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      updateThemeButton(next);
    });
  }

  initTheme();

  // Toast Function
  const showToast = (message = "Copied to clipboard!") => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  };

  // Clipboard Helper
  const copyText = (text, successMsg) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(() => {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showToast(successMsg);
    });
  };

  // Update CLI Command
  const updateCliCommand = () => {
    if (!terminalCmd) return;
    const target = hostSelect ? hostSelect.value : "all";
    const scope = document.querySelector('input[name="scope"]:checked')?.value || "user";
    const mode = document.querySelector('input[name="mode"]:checked')?.value || "copy";

    let cmd = `npx dotnet-production-agent-skills install --target ${target}`;
    if (scope === "project") {
      cmd += " --scope project";
    }
    if (mode === "link") {
      cmd += " --mode link";
    }

    terminalCmd.textContent = cmd;
  };

  if (hostSelect) {
    hostSelect.addEventListener("change", updateCliCommand);
  }
  scopeInputs.forEach(input => input.addEventListener("change", updateCliCommand));
  modeInputs.forEach(input => input.addEventListener("change", updateCliCommand));

  if (copyCmdBtn && terminalCmd) {
    copyCmdBtn.addEventListener("click", () => {
      copyText(terminalCmd.textContent.trim(), "CLI command copied!");
    });
  }

  // Render Skills
  const updateCatalogCounts = () => {
    if (heroSkillCount) heroSkillCount.textContent = `${skills.length} focused skills`;
    if (heroMetaCount) heroMetaCount.textContent = String(skills.length);

    categoryPills?.querySelectorAll(".pill-btn").forEach(button => {
      const category = button.getAttribute("data-category");
      const count = category === "all"
        ? skills.length
        : skills.filter(skill => skill.category === category).length;
      const countElement = button.querySelector("b");
      if (countElement) countElement.textContent = String(count);
    });
  };

  const renderSkills = () => {
    if (!skillsGrid) return;

    const filtered = skills.filter(item => {
      const matchesCategory = currentCategory === "all" || item.category === currentCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.whenToUse.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q)) ||
        item.categoryName.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });

    if (skillsCountEl) {
      skillsCountEl.textContent = `Showing ${filtered.length} of ${skills.length} skills`;
    }

    if (filtered.length === 0) {
      skillsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <p style="font-size: 2.2rem; margin-bottom: 12px;">🔍</p>
          <h3 style="font-size: 1.2rem; color: var(--text-primary); margin-bottom: 8px;">No matching skills found</h3>
          <p>Try refining your search term or selecting another category.</p>
        </div>
      `;
      return;
    }

    skillsGrid.innerHTML = filtered.map(item => `
      <article class="skill-card" data-id="${item.id}" tabindex="0" role="button" aria-label="View ${item.name} skill details">
        <div class="card-top">
          <div class="card-header-row">
            <span class="card-icon">${item.icon}</span>
            <h3 class="skill-name">${item.name}</h3>
            ${item.hasReferences ? `<span class="ref-indicator" title="Has reference docs">📚</span>` : ""}
          </div>
          <p class="skill-desc">${item.description}</p>
        </div>
        <div class="card-footer">
          <div class="card-tags">
            ${item.tags.slice(0, 3).map(tag => `<span class="tag-badge">${tag}</span>`).join("")}
          </div>
          <button class="view-btn" type="button" data-id="${item.id}">Details →</button>
        </div>
      </article>
    `).join("");

    // Click on card or view button opens modal
    skillsGrid.querySelectorAll(".skill-card").forEach(card => {
      const openCard = () => openModal(card.getAttribute("data-id"));
      card.addEventListener("click", (e) => {
        if (e.target.closest(".view-btn")) return;
        openCard();
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(); }
      });
    });
    skillsGrid.querySelectorAll(".view-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        openModal(e.currentTarget.getAttribute("data-id"));
      });
    });
  };

  // Category Filtering
  if (categoryPills) {
    categoryPills.addEventListener("click", (e) => {
      const btn = e.target.closest(".pill-btn");
      if (!btn) return;
      categoryPills.querySelectorAll(".pill-btn").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.getAttribute("data-category") || "all";
      renderSkills();
    });
  }

  // Search Input
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderSkills();
    });
  }

  // Modal Handling
  const openModal = (skillId) => {
    const skill = skills.find(s => s.id === skillId);
    if (!skill || !modalBackdrop) return;

    modalTitle.innerHTML = `${skill.icon} <span style="font-family: var(--font-mono);">${skill.name}</span>`;
    modalCategory.textContent = `${skill.categoryName} • ${skill.badge}`;
    modalDesc.textContent = skill.description;
    modalTrigger.textContent = skill.whenToUse;

    if (skill.hasReferences && skill.references.length > 0) {
      modalReferences.innerHTML = `
        <div style="margin-top: 16px;">
          <div class="modal-section-title">Deep Technical References</div>
          <ul style="padding-left: 20px; color: var(--text-secondary); font-size: 0.9rem;">
            ${skill.references.map(r => `<li><code>${r}</code></li>`).join("")}
          </ul>
        </div>
      `;
    } else {
      modalReferences.innerHTML = "";
    }

    modalPrompt.textContent = skill.examplePrompt;
    modalBackdrop.classList.add("open");
  };

  const closeModal = () => {
    if (modalBackdrop) {
      modalBackdrop.classList.remove("open");
    }
  };

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) {
        closeModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  });

  if (copyPromptBtn && modalPrompt) {
    copyPromptBtn.addEventListener("click", () => {
      copyText(modalPrompt.textContent.trim(), "Prompt example copied!");
    });
  }

  // Initial renders
  updateCatalogCounts();
  updateCliCommand();
  renderSkills();
});
