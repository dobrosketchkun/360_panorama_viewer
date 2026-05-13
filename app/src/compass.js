// SVG heading indicator. Click resets yaw to 0. Auto-hide handled by the
// shared idle-hide controller (fullscreen.js) since this element has class
// `.chrome`.

const SVG_NS = 'http://www.w3.org/2000/svg';

export class Compass {
  constructor(viewer, container) {
    this.viewer = viewer;
    this.el = document.createElementNS(SVG_NS, 'svg');
    this.el.setAttribute('viewBox', '0 0 24 24');
    this.el.classList.add('chrome', 'compass');
    this.el.setAttribute('aria-label', 'Compass — click to reset heading');
    this.el.innerHTML = `
      <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.4)" stroke-width="0.6"/>
      <line x1="12" y1="2" x2="12" y2="4.4" stroke="rgba(255,255,255,0.7)" stroke-width="0.8" stroke-linecap="round"/>
      <g class="indicator">
        <polygon points="12,5 9.6,13.2 12,11.2 14.4,13.2" fill="#f55" stroke="#fff" stroke-width="0.25"/>
      </g>
    `;
    this.indicator = this.el.querySelector('.indicator');
    this.el.addEventListener('click', () => this.viewer.resetHeading());
    container.appendChild(this.el);

    const tick = () => {
      const deg = this.viewer.getHeadingDegrees();
      this.indicator.setAttribute('transform', `rotate(${deg} 12 12)`);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
