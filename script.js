const stage = document.getElementById('stage');
const sprunkis = document.querySelectorAll('.sprunki');

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const activeSounds = new Map();

sprunkis.forEach(sprunki => {
  sprunki.addEventListener('dragstart', e => {
    e.dataTransfer.setData('sound', sprunki.dataset.sound);
    e.dataTransfer.setData('idle', sprunki.dataset.idle);
    e.dataTransfer.setData('active', sprunki.dataset.active);
  });
});

stage.addEventListener('dragover', e => e.preventDefault());

stage.addEventListener('drop', async e => {
  e.preventDefault();
  const soundFile = e.dataTransfer.getData('sound');
  const idleImg = e.dataTransfer.getData('idle');
  const activeImg = e.dataTransfer.getData('active');

  if (activeSounds.has(soundFile)) return;

  // Create Sprunki slot (start idle, switch to active)
  const slot = document.createElement('div');
  slot.className = 'stage-slot';

  const img = document.createElement('img');
  img.src = `assets/sprites/${idleImg}`; // Start idle
  slot.appendChild(img);
  stage.appendChild(slot);

  // Play sound
  const response = await fetch(`assets/audio/${soundFile}`);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = true;
  source.connect(audioContext.destination);
  source.start();

  // Switch to active animation
  img.src = `assets/sprites/${activeImg}`;

  activeSounds.set(soundFile, { source, slot });

  // Remove on click
  slot.addEventListener('click', () => {
    source.stop();
    slot.remove();
    activeSounds.delete(soundFile);
  });
});
