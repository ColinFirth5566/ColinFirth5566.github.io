const form = document.querySelector('.builder-form');
const commandEl = document.getElementById('command');
const regenBtn = document.getElementById('regen');

const revealTargets = document.querySelectorAll('.hero, .section, .site-footer');

const buildCommand = () => {
  const data = form.querySelector('[name="data"]').value.trim() || '/path/to/data';
  const output = form.querySelector('[name="output"]').value.trim() || '/path/to/output';
  const device = form.querySelector('[name="device"]').value;
  const precision = form.querySelector('[name="precision"]').value;
  const grid = form.querySelector('[name="grid"]').value;
  const threshold = form.querySelector('[name="threshold"]').value;
  const format = form.querySelector('[name="format"]').value;

  const exports = format === 'mesh+volume' ? ['mesh', 'volume'] : [format];
  const exportFlags = exports.map((item) => `--export ${item}`).join(' ');

  return [
    'python run_seg3d.py',
    `--data "${data}"`,
    `--out "${output}"`,
    `--device ${device}`,
    `--precision ${precision}`,
    `--grid ${grid}`,
    `--threshold ${threshold}`,
    exportFlags,
  ].join(' \\\n  ');
};

const updateCommand = () => {
  commandEl.textContent = buildCommand();
};

const copyCommand = async (targetId, button) => {
  const target = document.getElementById(targetId);
  if (!target) return;

  try {
    await navigator.clipboard.writeText(target.textContent);
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = original;
    }, 1400);
  } catch (err) {
    button.textContent = 'Copy failed';
  }
};

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealTargets.forEach((target) => {
  target.classList.add('reveal');
  observer.observe(target);
});

form.addEventListener('input', updateCommand);
regenBtn.addEventListener('click', updateCommand);

const copyButtons = document.querySelectorAll('[data-copy]');
copyButtons.forEach((button) => {
  button.addEventListener('click', () => copyCommand(button.dataset.copy, button));
});

updateCommand();
