const revealElements = document.querySelectorAll('.step-card, .impact-copy, .impact-board, .project > *');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 },
);

revealElements.forEach((element) => {
  element.classList.add('will-reveal');
  observer.observe(element);
});
