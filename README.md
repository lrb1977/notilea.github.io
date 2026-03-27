```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Noticias PY - Nueva Asunción</title>
    <style>
        :root {
            --primary: #0056b3;
            --secondary: #d32f2f;
            --accent: #fca311;
            --bg: #f4f6f8;
            --text: #1a1a1a;
            --card-bg: #ffffff;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        body {
            background-color: var(--bg);
            color: var(--text);
            line-height: 1.6;
            padding-bottom: 80px; /* Space for bottom nav if needed, or just footer */
        }

        /* Header */
        header {
            background: var(--primary);
            color: white;
            padding: 1rem;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: var(--shadow);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 800;
            letter-spacing: -0.5px;
        }

        .date-display {
            font-size: 0.8rem;
            opacity: 0.9;
            text-align: right;
        }

        /* Navigation */
        nav {
            background: white;
            overflow-x: auto;
            white-space: nowrap;
            padding: 0.5rem 1rem;
            border-bottom: 1px solid #e0e0e0;
            -webkit-overflow-scrolling: touch;
        }

        nav a {
            text-decoration: none;
            color: var(--text);
            font-weight: 600;
            margin-right: 1.5rem;
            padding: 0.5rem 0;
            display: inline-block;
            position: relative;
        }

        nav a.active {
            color: var(--primary);
        }

        nav a.active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: var(--primary);
        }

        /* Main Content */
        main {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1rem;
        }

        /* Hero Section */
        .hero {
            background: var(--card-bg);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: var(--shadow);
            margin-bottom: 1.5rem;
            position: relative;
        }

        .hero-img {
            width: 100%;
            height: 250px;
            object-fit: cover;
            display: block;
        }

        .hero-content {
            padding: 1.5rem;
        }

        .tag {
            background: var(--secondary);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 50px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            display: inline-block;
            margin-bottom: 0.5rem;
        }

        .hero-title {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
            line-height: 1.2;
        }

        .hero-excerpt {
            color: #666;
            font-size: 0.95rem;
        }

        /* Grid Layout */
        .news-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 1.5rem;
        }

        @media (min-width: 768px) {
            .news-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .hero-img {
                height: 400px;
            }
        }

        /* Cards */
        .card {
            background: var(--card-bg);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: var(--shadow);
            transition: transform 0.2s;
        }

        .card:active {
            transform: scale(0.98);
        }

        .card-img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            background: #ddd;
        }

        .card-body {
            padding: 1rem;
        }

        .card-title {
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }

        .card-meta {
            font-size: 0.8rem;
            color: #888;
            margin-top: 0.5rem;
            display: flex;
            justify-content: space-between;
        }

        /* Weather Widget */
        .weather-widget {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 1.5rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: var(--shadow);
        }

        .weather-info h3 {
            font-size: 0.9rem;
            opacity: 0.9;
            margin-bottom: 0.25rem;
        }

        .weather-temp {
            font-size: 2.5rem;
            font-weight: 800;
        }

        .weather-icon {
            width: 80px;
            height: 80px;
            object-fit: contain;
        }

        /* Footer */
        footer {
            text-align: center;
            padding: 2rem 1rem;
            color: #666;
            font-size: 0.9rem;
            border-top: 1px solid #e0e0e0;
            margin-top: 2rem;
            background: white;
        }

        .btn-read {
            display: inline-block;
            margin-top: 1rem;
            color: var(--primary);
            font-weight: 600;
            text-decoration: none;
        }
    </style>
</head>
<body>

    <header>
        <div class="logo">PY Noticias</div>
        <div class="date-display" id="currentDate">Cargando fecha...</div>
    </header>

    <nav>
        <a href="#inicio" class="active">Inicio</a>
        <a href="#nueva-asuncion">Nueva Asunción</a>
        <a href="#paraguay">Paraguay</a>
        <a href="#mundo">Mundo</a>
        <a href="#clima">Clima</a>
    </nav>

    <main>
        <!-- Hero Section -->
        <section class="hero" id="inicio">
            <img src="https://image.qwenlm.ai/public_source/66af1231-1e3a-4bd1-bc39-317f34b63898/12c1cba98-d334-491b-908e-105cd0f9992e.png" alt="Asunción Paraguay" class="hero-img">
            <div class="hero-content">
                <span class="tag">Destacado</span>
                <h1 class="hero-title">Nuevas inversiones impulsan la economía en la región central</h1>
                <p class="hero-excerpt">El gobierno anuncia un plan de infraestructura que beneficiará directamente a los departamentos de Presidente Hayes y Central.</p>
                <a href="#" class="btn-read">Leer más →</a>
            </div>
        </section>

        <!-- Weather Widget -->
        <section class="weather-widget" id="clima">
            <div class="weather-info">
                <h3>Nueva Asunción, PY</h3>
                <div class="weather-temp">32°C</div>
                <p>Parcialmente Nublado</p>
                <p style="font-size: 0.8rem; opacity: 0.8;">H: 36° L: 24°</p>
            </div>
            <img src="https://image.qwenlm.ai/public_source/66af1231-1e3a-4bd1-bc39-317f34b63898/198c61ffd-15d0-4c54-8151-ec98c52283a5.png" alt="Clima" class="weather-icon">
        </section>

        <!-- News Grid -->
        <div class="news-grid">
            
            <!-- Local News -->
            <article class="card" id="nueva-asuncion">
                <img src="https://image.qwenlm.ai/public_source/66af1231-1e3a-4bd1-bc39-317f34b63898/1f1362269-4f3d-4eb1-bb47-0dc6209024a6.png" alt="Nueva Asunción" class="card-img">
                <div class="card-body">
                    <span class="tag" style="background: var(--accent); color: #000;">Local</span>
                    <h2 class="card-title">Comunidad de Nueva Asunción celebra fiestas patronales</h2>
                    <p style="font-size: 0.9rem; color: #555; margin-top: 0.5rem;">Los vecinos se reúnen para celebrar la tradición con música, danza y gastronomía típica del Chaco.</p>
                    <div class="card-meta">
                        <span>Hace 2 horas</span>
                        <span>Presidente Hayes</span>
                    </div>
                </div>
            </article>

            <!-- Paraguay News -->
            <article class="card" id="paraguay">
                <div style="height: 200px; background: #e3f2fd; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M17 21v-8.5a1.5 1.5 0 0 0-3 0V21"/><path d="M7 21v-5a1.5 1.5 0 0 1 3 0v5"/></svg>
                </div>
                <div class="card-body">
                    <span class="tag">Nacional</span>
                    <h2 class="card-title">Avances en la construcción de la ruta bioceánica</h2>
                    <p style="font-size: 0.9rem; color: #555; margin-top: 0.5rem;">Las obras continúan a ritmo acelerado conectando el Atlántico con el Pacífico a través del territorio nacional.</p>
                    <div class="card-meta">
                        <span>Hace 4 horas</span>
                        <span>Asunción</span>
                    </div>
                </div>
            </article>

            <!-- World News -->
            <article class="card" id="mundo">
                <div style="height: 200px; background: #e8eaf6; display: flex; align-items: center; justify-content: center; color: #3f51b5;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </div>
                <div class="card-body">
                    <span class="tag" style="background: #607d8b;">Mundo</span>
                    <h2 class="card-title">Cumbre internacional aborda el cambio climático</h2>
                    <p style="font-size: 0.9rem; color: #555; margin-top: 0.5rem;">Líderes mundiales se comprometen a reducir emisiones de carbono en la próxima década.</p>
                    <div class="card-meta">
                        <span>Hace 6 horas</span>
                        <span>Internacional</span>
                    </div>
                </div>
            </article>

             <!-- More Local -->
             <article class="card">
                <div style="height: 200px; background: #fff3e0; display: flex; align-items: center; justify-content: center; color: #ef6c00;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <div class="card-body">
                    <span class="tag" style="background: var(--accent); color: #000;">Local</span>
                    <h2 class="card-title">Productores del Chaco esperan buenas lluvias</h2>
                    <p style="font-size: 0.9rem; color: #555; margin-top: 0.5rem;">La cámara de agricultura de Presidente Hayes monitorea el clima para la próxima cosecha.</p>
                    <div class="card-meta">
                        <span>Hace 8 horas</span>
                        <span>Chaco</span>
                    </div>
                </div>
            </article>

        </div>
    </main>

    <footer>
        <p>&copy; 2023 Noticias Paraguay & Nueva Asunción.</p>
        <p style="font-size: 0.8rem; margin-top: 0.5rem;">Desarrollado para móviles Android.</p>
    </footer>

    <script>
        // Set current date in Spanish
        const dateElement = document.getElementById('currentDate');
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date();
        // Capitalize first letter
        let dateString = today.toLocaleDateString('es-ES', options);
        dateString = dateString.charAt(0).toUpperCase() + dateString.slice(1);
        dateElement.textContent = dateString;

        // Simple smooth scroll for nav links
        document.querySelectorAll('nav a').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
                this.classList.add('active');
                
                const targetId = this.getAttribute('href');
                const targetSection = document.querySelector(targetId);
                
                if(targetSection) {
                    window.scrollTo({
                        top: targetSection.offsetTop - 100, // Offset for sticky header
                        behavior: 'smooth'
                    });
                }
            });
        });
    </script>
</body>
</html>
``````html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Noticias PY - Nueva Asunción</title>
    <style>
        :root {
            --primary: #0056b3;
            --secondary: #d32f2f;
            --accent: #fca311;
            --bg: #f4f6f8;
            --text: #1a1a1a;
            --card-bg: #ffffff;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        body {
            background-color: var(--bg);
            color: var(--text);
            line-height: 1.6;
            padding-bottom: 80px; /* Space for bottom nav if needed, or just footer */
        }

        /* Header */
        header {
            background: var(--primary);
            color: white;
            padding: 1rem;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: var(--shadow);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 800;
            letter-spacing: -0.5px;
        }

        .date-display {
            font-size: 0.8rem;
            opacity: 0.9;
            text-align: right;
        }

        /* Navigation */
        nav {
            background: white;
            overflow-x: auto;
            white-space: nowrap;
            padding: 0.5rem 1rem;
            border-bottom: 1px solid #e0e0e0;
            -webkit-overflow-scrolling: touch;
        }

        nav a {
            text-decoration: none;
            color: var(--text);
            font-weight: 600;
            margin-right: 1.5rem;
            padding: 0.5rem 0;
            display: inline-block;
            position: relative;
        }

        nav a.active {
            color: var(--primary);
        }

        nav a.active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: var(--primary);
        }

        /* Main Content */
        main {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1rem;
        }

        /* Hero Section */
        .hero {
            background: var(--card-bg);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: var(--shadow);
            margin-bottom: 1.5rem;
            position: relative;
        }

        .hero-img {
            width: 100%;
            height: 250px;
            object-fit: cover;
            display: block;
        }

        .hero-content {
            padding: 1.5rem;
        }

        .tag {
            background: var(--secondary);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 50px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            display: inline-block;
            margin-bottom: 0.5rem;
        }

        .hero-title {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
            line-height: 1.2;
        }

        .hero-excerpt {
            color: #666;
            font-size: 0.95rem;
        }

        /* Grid Layout */
        .news-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 1.5rem;
        }

        @media (min-width: 768px) {
            .news-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            .hero-img {
                height: 400px;
            }
        }

        /* Cards */
        .card {
            background: var(--card-bg);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: var(--shadow);
            transition: transform 0.2s;
        }

        .card:active {
            transform: scale(0.98);
        }

        .card-img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            background: #ddd;
        }

        .card-body {
            padding: 1rem;
        }

        .card-title {
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }

        .card-meta {
            font-size: 0.8rem;
            color: #888;
            margin-top: 0.5rem;
            display: flex;
            justify-content: space-between;
        }

        /* Weather Widget */
        .weather-widget {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 1.5rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: var(--shadow);
        }

        .weather-info h3 {
            font-size: 0.9rem;
            opacity: 0.9;
            margin-bottom: 0.25rem;
        }

        .weather-temp {
            font-size: 2.5rem;
            font-weight: 800;
        }

        .weather-icon {
            width: 80px;
            height: 80px;
            object-fit: contain;
        }

        /* Footer */
        footer {
            text-align: center;
            padding: 2rem 1rem;
            color: #666;
            font-size: 0.9rem;
            border-top: 1px solid #e0e0e0;
            margin-top: 2rem;
            background: white;
        }

        .btn-read {
            display: inline-block;
            margin-top: 1rem;
            color: var(--primary);
            font-weight: 600;
            text-decoration: none;
        }
    </style>
</head>
<body>

    <header>
        <div class="logo">PY Noticias</div>
        <div class="date-display" id="currentDate">Cargando fecha...</div>
    </header>

    <nav>
        <a href="#inicio" class="active">Inicio</a>
        <a href="#nueva-asuncion">Nueva Asunción</a>
        <a href="#paraguay">Paraguay</a>
        <a href="#mundo">Mundo</a>
        <a href="#clima">Clima</a>
    </nav>

    <main>
        <!-- Hero Section -->
        <section class="hero" id="inicio">
            <img src="https://image.qwenlm.ai/public_source/66af1231-1e3a-4bd1-bc39-317f34b63898/12c1cba98-d334-491b-908e-105cd0f9992e.png" alt="Asunción Paraguay" class="hero-img">
            <div class="hero-content">
                <span class="tag">Destacado</span>
                <h1 class="hero-title">Nuevas inversiones impulsan la economía en la región central</h1>
                <p class="hero-excerpt">El gobierno anuncia un plan de infraestructura que beneficiará directamente a los departamentos de Presidente Hayes y Central.</p>
                <a href="#" class="btn-read">Leer más →</a>
            </div>
        </section>

        <!-- Weather Widget -->
        <section class="weather-widget" id="clima">
            <div class="weather-info">
                <h3>Nueva Asunción, PY</h3>
                <div class="weather-temp">32°C</div>
                <p>Parcialmente Nublado</p>
                <p style="font-size: 0.8rem; opacity: 0.8;">H: 36° L: 24°</p>
            </div>
            <img src="https://image.qwenlm.ai/public_source/66af1231-1e3a-4bd1-bc39-317f34b63898/198c61ffd-15d0-4c54-8151-ec98c52283a5.png" alt="Clima" class="weather-icon">
        </section>

        <!-- News Grid -->
        <div class="news-grid">
            
            <!-- Local News -->
            <article class="card" id="nueva-asuncion">
                <img src="https://image.qwenlm.ai/public_source/66af1231-1e3a-4bd1-bc39-317f34b63898/1f1362269-4f3d-4eb1-bb47-0dc6209024a6.png" alt="Nueva Asunción" class="card-img">
                <div class="card-body">
                    <span class="tag" style="background: var(--accent); color: #000;">Local</span>
                    <h2 class="card-title">Comunidad de Nueva Asunción celebra fiestas patronales</h2>
                    <p style="font-size: 0.9rem; color: #555; margin-top: 0.5rem;">Los vecinos se reúnen para celebrar la tradición con música, danza y gastronomía típica del Chaco.</p>
                    <div class="card-meta">
                        <span>Hace 2 horas</span>
                        <span>Presidente Hayes</span>
                    </div>
                </div>
            </article>

            <!-- Paraguay News -->
            <article class="card" id="paraguay">
                <div style="height: 200px; background: #e3f2fd; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M17 21v-8.5a1.5 1.5 0 0 0-3 0V21"/><path d="M7 21v-5a1.5 1.5 0 0 1 3 0v5"/></svg>
                </div>
                <div class="card-body">
                    <span class="tag">Nacional</span>
                    <h2 class="card-title">Avances en la construcción de la ruta bioceánica</h2>
                    <p style="font-size: 0.9rem; color: #555; margin-top: 0.5rem;">Las obras continúan a ritmo acelerado conectando el Atlántico con el Pacífico a través del territorio nacional.</p>
                    <div class="card-meta">
                        <span>Hace 4 horas</span>
                        <span>Asunción</span>
                    </div>
                </div>
            </article>

            <!-- World News -->
            <article class="card" id="mundo">
                <div style="height: 200px; background: #e8eaf6; display: flex; align-items: center; justify-content: center; color: #3f51b5;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </div>
                <div class="card-body">
                    <span class="tag" style="background: #607d8b;">Mundo</span>
                    <h2 class="card-title">Cumbre internacional aborda el cambio climático</h2>
                    <p style="font-size: 0.9rem; color: #555; margin-top: 0.5rem;">Líderes mundiales se comprometen a reducir emisiones de carbono en la próxima década.</p>
                    <div class="card-meta">
                        <span>Hace 6 horas</span>
                        <span>Internacional</span>
                    </div>
                </div>
            </article>

             <!-- More Local -->
             <article class="card">
                <div style="height: 200px; background: #fff3e0; display: flex; align-items: center; justify-content: center; color: #ef6c00;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <div class="card-body">
                    <span class="tag" style="background: var(--accent); color: #000;">Local</span>
                    <h2 class="card-title">Productores del Chaco esperan buenas lluvias</h2>
                    <p style="font-size: 0.9rem; color: #555; margin-top: 0.5rem;">La cámara de agricultura de Presidente Hayes monitorea el clima para la próxima cosecha.</p>
                    <div class="card-meta">
                        <span>Hace 8 horas</span>
                        <span>Chaco</span>
                    </div>
                </div>
            </article>

        </div>
    </main>

    <footer>
        <p>&copy; 2023 Noticias Paraguay & Nueva Asunción.</p>
        <p style="font-size: 0.8rem; margin-top: 0.5rem;">Desarrollado para móviles Android.</p>
    </footer>

    <script>
        // Set current date in Spanish
        const dateElement = document.getElementById('currentDate');
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date();
        // Capitalize first letter
        let dateString = today.toLocaleDateString('es-ES', options);
        dateString = dateString.charAt(0).toUpperCase() + dateString.slice(1);
        dateElement.textContent = dateString;

        // Simple smooth scroll for nav links
        document.querySelectorAll('nav a').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
                this.classList.add('active');
                
                const targetId = this.getAttribute('href');
                const targetSection = document.querySelector(targetId);
                
                if(targetSection) {
                    window.scrollTo({
                        top: targetSection.offsetTop - 100, // Offset for sticky header
                        behavior: 'smooth'
                    });
                }
            });
        });
    </script>
</body>
</html>
```
