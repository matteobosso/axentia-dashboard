(function() {

	"use strict";
  
	const app = {
		
		init: () => {

			//=== Start page ===\\
			app.startPage();

			//=== Lazy loading ===\\
			app.lazyLoading();

			app.setUpListeners();

			//=== Elements wide fixed ===\\
			app.elWideFixed.init();

			//=== Article ===\\
			app.article.init();

			app.customLog();

		},
 
		setUpListeners: () => {

			//=== Tabs ===\\
			const tabsNav = document.querySelectorAll(".tabs-nav li");
			if(tabsNav.length) {
				tabsNav.forEach(item => { item.addEventListener("click", app.tabs); });
			}

			//=== Accordion ===\\
			const accordionBtn = document.querySelectorAll(".accordion-btn");
			if(accordionBtn.length) {
				accordionBtn.forEach(item => { item.addEventListener("click", app.accordion); });
			}

			//=== Menu ===\\
			const menuBtn = document.querySelector(".mnu-btn");
			if(menuBtn !== null) { menuBtn.addEventListener("click", app.menu.init); }

			window.addEventListener('scroll', app.toggleHeaderElements);


			// === Brand description (hover desktop + tap mobile) === \\\\\\
			const brandArea = document.querySelector('.brand-area');
			const brandItems = document.querySelectorAll('.brand-area .brand-item');
			const brandDescBox = document.getElementById('brand-description');

			if (brandArea && brandItems.length && brandDescBox) {
			const defaultHtml = brandDescBox.innerHTML;

			const showDesc = (html) => {
				brandDescBox.classList.add('fade-out'); // Inizia a sparire

				setTimeout(() => {
					brandDescBox.innerHTML = html; // Cambia testo mentre è invisibile
					brandDescBox.classList.remove('fade-out'); // Riappare con il nuovo testo
				}, 300); // Tempo coordinato con la transizione CSS
			};

			const resetDesc = () => {
				brandDescBox.classList.add('fade-out');

				setTimeout(() => {
					brandDescBox.innerHTML = defaultHtml; // Torna al default
					brandDescBox.classList.remove('fade-out');
				}, 300);
			};

			// Hover (desktop)
			brandItems.forEach(item => {
				item.addEventListener('mouseenter', () => {
				if (window.innerWidth > 768) showDesc(item.dataset.description);
				});
				item.addEventListener('mouseleave', () => {
				if (window.innerWidth > 768) resetDesc();
				});

				// Tap (mobile)
				item.addEventListener('click', () => {
				if (window.innerWidth <= 768) showDesc(item.dataset.description);
				});

				// Accessibilità: focus da tastiera su desktop
				item.setAttribute('tabindex', '0');
				item.addEventListener('focus', () => {
				if (window.innerWidth > 768) showDesc(item.dataset.description);
				});
				item.addEventListener('blur', () => {
				if (window.innerWidth > 768) resetDesc();
				});
			});
			}

			//=== Reveal animations ===\\

			//Index.HTML
			//hero
			app.revealWords('hero-title-1', 'up', false, 0.0, 0.1, 0.8);
			app.revealBlock('hero-desc-1', 'left', false, 0.1, 0.8);
			app.revealBlock('hero-desc-2', 'left', false, 0.2, 0.8);
			app.revealBlock('hero-desc-3', 'left', false, 0.4, 0.8);
			app.revealBlock('hero-desc-4', 'left', false, 0.5, 0.8);
			app.revealSvg('svg-1', false, 0.0, 1.5, 0.4);
			app.revealSvg('svg-2', false, 0.2, 1.5, 0.4);
			//vision
			app.revealBlock('vision-1', 'left', true, 0.2, 0.6);
			app.revealBlock('vision-2', 'left', true, 0.2, 0.6);
			app.revealShLine('line-1','left', true, 0.0, 0.8);
			app.revealBlock('vision-desc', 'up', true, 0.2, 0.8);
			app.revealFade('vision-cit', true, 0.2, 1, 'none');
			//services
			app.revealBlock('services-title', 'right', true, 0.2, 0.6);
			app.revealBlock('services-desc', 'right', true, 0.2, 0.6);
			app.revealShLine('services-line','right', true, 0.0, 0.8);
			app.revealBlock('service-1-1', 'up', true, 0.0, 0.8);
			app.revealBlock('service-2-1', 'up', true, 0.2, 0.8);
			app.revealBlock('service-3-1', 'up', true, 0.4, 0.8);
			app.revealBlock('service-1-2', 'left', true, 0.0, 1);
			app.revealBlock('service-2-2', 'left', true, 0.2, 1);
			app.revealBlock('service-3-2', 'left', true, 0.4, 1);
			//automation
			app.revealBlock('auto-title', 'right', true, 0.2, 0.6);
			app.revealShLine('auto-line','right', true, 0.0, 0.8);
			//CTA
			app.revealBlock('cta-title', 'right', true, 0.2, 0.8);
			app.revealBlock('cta-desc', 'right', true, 0.2, 0.8);
			app.revealSvg('cta-btn-1', true, 0.2, 1.5, 0.4);
			app.revealSvg('cta-btn-2', true, 0.2, 1.5, 0.4);

			//Chi-siamo.HTML / Contatti.HTML
			//Body
			app.revealBlock('title-block','up', true, 0.0, 1.2);
			app.revealFade('body-block', true, 0.0, 1.2,'none');

			//FAQs.HTML
			//FAQs items
			app.revealFade('faq-1', true, 0.0, 0.7,'up');
			app.revealFade('faq-2', true, 0.0, 0.7,'up');
			app.revealFade('faq-3', true, 0.0, 0.7,'up');
			app.revealFade('faq-4', true, 0.0, 0.7,'up');
			app.revealFade('faq-5', true, 0.0, 0.7,'up');
			app.revealFade('faq-6', true, 0.0, 0.7,'up');

			//=== Custom menu dropdown ===\\
			document.addEventListener('DOMContentLoaded', function() {
				// Seleziona tutti i trigger
				const triggers = document.querySelectorAll('.ax-trigger');

				triggers.forEach(trigger => {
					trigger.addEventListener('click', function(e) {
						e.preventDefault();
						
						// Trova il genitore '.has-dropdown' più vicino a questo specifico trigger
						const parent = this.closest('.has-dropdown');

						if (parent) {
							// Opzionale: chiude gli altri dropdown aperti
							document.querySelectorAll('.has-dropdown').forEach(item => {
								if (item !== parent) item.classList.remove('is-open');
							});

							// Apre/chiude quello cliccato
							parent.classList.toggle('is-open');
						}
					});
				});
			});

		},

		//=== Start page ===\\
		startPage: () => {

			const preloader = document.querySelector(".preloader");

			if(preloader !== null) {

				preloader.classList.remove("active");

			}

		},

		//=== Lazy loading ===\\
		lazyLoading: () => {

			const observer = lozad(".lazy", {
				loaded: el => {

					if(el.tagName.toLowerCase() === 'picture') {

						const sources = el.querySelectorAll("source");
		
						if(sources.length) {
		
							sources.forEach( (item) => {
		
								const srcset = item.getAttribute('data-srcset');
		
								if(srcset !== null) {
									
									item.setAttribute("srcset", srcset);
									item.removeAttribute("data-srcset");
		
								}
		
							});
		
						}
		
					}

				}
			});
			observer.observe();

		},

		//=== Tabs ===\\
		tabs: e => {

			let _this = e.currentTarget,
				index = [..._this.parentNode.children].indexOf(_this),
				tabs = _this.closest(".tabs"),
				items = tabs.querySelectorAll(".tabs-item");

			if (!_this.classList.contains("active")) {

				_this.classList.add("active");
				items[index].classList.add("active");

				[..._this.parentNode.children].filter((child) => {
                    if( child !== _this ) { child.classList.remove("active"); }
                });
                [...items[index].parentNode.children].filter((child) => {
                    if( child !== items[index] ) { child.classList.remove("active"); }
                });
			
			}

		},

		//=== Accordion ===\\
		ACCORDION_FLAG: true,
		accordion: e => {

			e.preventDefault();

			const duration = 400;

			if(app.ACCORDION_FLAG === true) {

				app.ACCORDION_FLAG = false;

				const _this = e.currentTarget,
					  item = _this.closest(".accordion-item"),
					  container = _this.closest(".accordion"),
					  items = container.querySelectorAll(".accordion-item"),
					  content = item.querySelector(".accordion-content"),
					  activeContent = container.querySelector(".accordion-item.active .accordion-content");
			
				if (!item.classList.contains("active")) {
					items.forEach(function(item) { item.classList.remove("active"); });
					item.classList.add("active");
					if(activeContent !== null) { app.slideUp(activeContent, duration); }
					app.slideDown(content, duration);
				} else {
					item.classList.remove("active");
					app.slideUp(content, duration);
				}

			}

			window.setTimeout(function() { app.ACCORDION_FLAG = true }, duration);

		},

		//=== Menu ===\\
		menu: {

			BODY: document.getElementsByTagName("body")[0],
			HEADER: document.querySelector(".header"),
			TARGET: document.querySelector(".main-menu"),

			init: () => {

				if(!app.menu.TARGET.classList.contains("main-menu-transition")) {
					app.menu.TARGET.classList.add("main-menu-transition");	
				}
	
				app.menu.BODY.classList.toggle("mm-open");

				if(window.pageYOffset === 0) { app.menu.HEADER.classList.toggle("header-min"); }

				if(app.menu.BODY.classList.contains("mm-open")) {

					app.menu.animIn();
					
				} else {

					app.menu.animOut();

				}
	
			},

			animIn: () => {

				setTimeout(function() { app.menu.BODY.classList.add("overflow-hidden"); }, 300);
				
			},

			animOut: () => {

				app.menu.BODY.classList.remove("overflow-hidden");

			},
 
		},

		toggleHeaderElements: () => {
			const headerElements = document.querySelectorAll('.header .header-brand-is, .header .header-nav');
			headerElements.forEach(el => {
				if (window.scrollY > 0) {
				el.style.opacity = '0';
				el.style.visibility = 'hidden';
				} else {
				el.style.opacity = '1';
				el.style.visibility = 'visible';
				}
				el.style.transition = 'opacity 0.2s ease, visibility 0.2s ease';
			});
		},

		//=== Elements wide fixed ===\\
		elWideFixed: {

			init: () => {

				app.elWideFixed.body();
				window.addEventListener("resize", function() { app.elWideFixed.body(); });

			},

			body: () => {

				const widht = document.querySelector('body').offsetWidth;
				const container = document.querySelector(".container");
				const containerWidth = container.offsetWidth;
				const containerPadding = Number.parseInt( getComputedStyle(container, null).getPropertyValue('padding-right') );

				const footerFixed = document.querySelector(".footer-fixed");
				if(footerFixed !== null) {

					const footerFixedWidth = footerFixed.offsetWidth;

					if(widht > containerWidth) {

						footerFixed.style.right = ( ( ( widht - containerWidth ) / 2 ) + ( containerPadding - footerFixedWidth ) / 2 ) + "px";
						footerFixed.classList.add("footer-wide");

					} else {

						if(footerFixed.classList.contains('footer-wide')) {
							footerFixed.removeAttribute('style');
							footerFixed.classList.remove("footer-wide");
						}

					}

				}

			},

		},

		//=== Article ===\\
		article: {

			init: () => {

				app.article.table.responsive();

			},

			table: {

				responsive: () => {

					const articles = document.querySelectorAll(".article");
					if(articles.length) { articles.forEach(article => {
							const tables = article.querySelectorAll("table");
							if(tables.length) { tables.forEach(table => {
								app.article.table.wrap(table);
							}); }
					}); }

				},

				wrap: (table) => {

					const wrapper = document.createElement('div');
					wrapper.classList.add("table-responsive");
					table.replaceWith(wrapper);
					wrapper.appendChild(table);

					const wrapper2 = document.createElement('div');
					wrapper2.classList.add("table-responsive-outer");
					wrapper.replaceWith(wrapper2);
					wrapper2.appendChild(wrapper);

				}

			},

		},

		slideDown: target => {

			const duration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 500;

			target.style.removeProperty('display');
			let display = window.getComputedStyle(target).display;
			if (display === 'none') display = 'block';
			target.style.display = display;
			const height = target.offsetHeight;
			target.style.overflow = 'hidden';
			target.style.height = 0;
			target.style.paddingTop = 0;
			target.style.paddingBottom = 0;
			target.style.marginTop = 0;
			target.style.marginBottom = 0;
			target.offsetHeight;
			target.style.boxSizing = 'border-box';
			target.style.transitionProperty = "height, margin, padding";
			target.style.transitionDuration = duration + 'ms';
			target.style.height = height + 'px';
			target.style.removeProperty('padding-top');
			target.style.removeProperty('padding-bottom');
			target.style.removeProperty('margin-top');
			target.style.removeProperty('margin-bottom');
			window.setTimeout(function() {
				  target.style.removeProperty('height');
				  target.style.removeProperty('overflow');
				  target.style.removeProperty('transition-duration');
				  target.style.removeProperty('transition-property');
			}, duration);

		},
		slideUp: target => {

			const duration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 500;

			target.style.transitionProperty = 'height, margin, padding';
			target.style.transitionDuration = duration + 'ms';
			target.style.boxSizing = 'border-box';
			target.style.height = target.offsetHeight + 'px';
			target.offsetHeight;
			target.style.overflow = 'hidden';
			target.style.height = 0;
			target.style.paddingTop = 0;
			target.style.paddingBottom = 0;
			target.style.marginTop = 0;
			target.style.marginBottom = 0;
			window.setTimeout(function() {
				  target.style.display = 'none';
				  target.style.removeProperty('height');
				  target.style.removeProperty('padding-top');
				  target.style.removeProperty('padding-bottom');
				  target.style.removeProperty('margin-top');
				  target.style.removeProperty('margin-bottom');
				  target.style.removeProperty('overflow');
				  target.style.removeProperty('transition-duration');
				  target.style.removeProperty('transition-property');
			}, duration);

		},
		slideToggle: target => {

			const duration = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 500;

			if (window.getComputedStyle(target).display === 'none') {

			  return app.slideDown(target, duration);

			} else {

			  return app.slideUp(target, duration);

			}

		},
		
		customLog: () => {

			const styles = [
					//'font-size: 14px',
					//'color: #ffffff',
					//'background-color: #000000',
					//'padding: 4px 0 4px 8px'
				].join(';'),
				brandStyles = [
					//'font-size: 14px',
					//'color: #ffffff',
					//'background-color: #000000',
					//'padding: 4px 8px 4px 0',
					'font-weight: bold'
				].join(';'),
				text = '%cby %cAxentia lean Automation - www.axentia-automation.it';

			console.log(text, styles, brandStyles);

		},

		revealWords: (elementId, direction = 'up', onScroll = true, startDelay = 0, stagger = 0.05, duration = 0.8) => {
			const container = document.getElementById(elementId);
			if (!container) return;

			// Filtra per evitare spazi vuoti multipli che rompono il layout
			const words = container.innerText.trim().split(/\s+/);
			container.innerHTML = '';
			
			words.forEach((word, index) => {
				const wrapper = document.createElement('span');
				wrapper.className = 'reveal-word-wrapper';

				const span = document.createElement('span');
				span.className = 'reveal-item';
				span.innerText = word;
				
				span.style.transitionDuration = `${duration}s`;
				span.style.transitionDelay = `${startDelay + (index * stagger)}s`;
				span.style.transform = app.getStartTransform(direction);

				wrapper.appendChild(span);
				container.appendChild(wrapper);

				// Aggiunge uno spazio reale tra le parole per permettere il wrapping naturale
				if (index < words.length - 1) {
					container.appendChild(document.createTextNode(' '));
				}
			});

			app.initObserver(container, onScroll);
		},

		//=== Reveal block ===\\
		revealBlock: (elementId, direction = 'up', onScroll = true, startDelay = 0, duration = 0.8) => {
			const container = document.getElementById(elementId);
			if (!container) return;
			const content = container.innerHTML;
			container.innerHTML = '';
			const wrapper = document.createElement('span');
			wrapper.className = 'reveal-container reveal-block-wrapper';
			
			const span = document.createElement('span');
			span.className = 'reveal-item';
			span.style.display = 'block'; // Necessario per l'animazione di blocco
			span.innerHTML = content;
			span.style.transitionDuration = `${duration}s`;
			span.style.transitionDelay = `${startDelay}s`;
			span.style.transform = app.getStartTransform(direction);

			wrapper.appendChild(span);
			container.appendChild(wrapper);
			app.initObserver(container, onScroll);
		},

		revealSvg: (elementId, onScroll = true, startDelay = 0, duration = 1.5, stagger = 0.2) => {
			const container = document.getElementById(elementId);
			if (!container) return;

			const paths = container.querySelectorAll('path, circle, rect, polyline');

			paths.forEach((path, index) => {
				const length = path.getTotalLength();
				
				// 1. Reset immediato
				path.style.transition = 'none'; // Disabilita transizioni per il reset
				path.style.strokeDasharray = length;
				path.style.strokeDashoffset = length;
				path.classList.add('reveal-svg-path');
				path.classList.remove('is-animated');

				// 2. Forza il calcolo
				path.getBoundingClientRect();

				// 3. Applica i parametri di animazione dopo che il browser ha resettato
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						path.style.transition = ''; // Riabilita le transizioni del CSS
						path.style.transitionDuration = `${duration}s`;
						path.style.transitionDelay = `${startDelay + (index * stagger)}s`;
						
						// Se non dobbiamo aspettare lo scroll, attiva subito
						if (!onScroll) path.classList.add('is-animated');
					});
				});
			});

			// 4. Observer per attivazione allo scroll
			if (onScroll) {
				const obs = new IntersectionObserver(entries => {
					if (entries[0].isIntersecting) {
						container.querySelectorAll('.reveal-svg-path').forEach(p => p.classList.add('is-animated'));
						obs.unobserve(container);
					}
				}, { threshold: 0.2 });
				obs.observe(container);
			}
		},

		revealShLine: (elementId, onScroll = true, direction = 'right', startDelay = 0, duration = 2) => {
			const container = document.getElementById(elementId);
			if (!container) return console.error("Container non trovato");

			if (direction === 'left') container.classList.add('dir-left');

			const path = container.querySelector('path');
			const length = path.getTotalLength();
			
			console.log("Lunghezza linea:", length); // Se stampa 0, il path non è caricato bene

			path.style.strokeDasharray = length;
			path.style.strokeDashoffset = length;

			const activate = () => {
				path.style.transition = `stroke-dashoffset ${duration}s ease-out ${startDelay}s`;
				path.style.strokeDashoffset = "0";
				path.classList.add('is-visible');
			};


			if (onScroll) {
				const observer = new IntersectionObserver((entries) => {
					if (entries[0].isIntersecting) {
						activate();
						observer.unobserve(container);
					}
				}, { threshold: 0.2 });
				observer.observe(container);
			} else {
				activate();
			}
		},

		revealFade: (elementId, onScroll = true, startDelay = 0, duration = 0.8, direction = 'up') => {
			const el = document.getElementById(elementId);
			if (!el) return;

			// Imposta lo stato iniziale basato sulla direzione
			el.classList.add('reveal-fade-in');
			if (direction !== 'none') {
				el.style.transform = app.getStartTransform(direction);
			}

			el.style.transitionDuration = `${duration}s`;
			el.style.transitionDelay = `${startDelay}s`;

			const activate = () => {
				el.getBoundingClientRect(); // Forza il calcolo della posizione iniziale
				el.classList.add('reveal-active');
			};

			if (onScroll) {
				const observer = new IntersectionObserver((entries) => {
					if (entries[0].isIntersecting) {
						activate();
						observer.unobserve(el);
					}
				}, { threshold: 0.0 });
				observer.observe(el);
			} else {
				activate();
			}
		},

		getStartTransform: (direction) => {
			switch(direction) {
				case 'up':    return 'translateY(110%)';
				case 'down':  return 'translateY(-110%)';
				case 'left':  return 'translateX(60px)';
				case 'right': return 'translateX(-60px)';
				default:      return 'translateY(110%)';
			}
		},

		initObserver: (container, onScroll) => {
			const activate = () => {
				container.querySelectorAll('.reveal-item').forEach(el => el.classList.add('reveal-active'));
			};
			if (onScroll) {
				const obs = new IntersectionObserver(entries => {
					if (entries[0].isIntersecting) { activate(); obs.unobserve(container); }
				}, { threshold: 0.2 });
				obs.observe(container);
			} else {
				setTimeout(activate, 100);
			}
		}


		
	}
 
	app.init();
 
}());
