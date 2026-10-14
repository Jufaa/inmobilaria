'use client';
import Link from 'next/link';
import { useDemo } from './DemoProvider';
import { useEffect, useState } from 'react';
const tasks = [
  {
    title: 'Encontrar un departamento',
    text: 'Abrí el buscador. Elegí Alquilar, la moneda que querés usar y escribí “sur”. Confirmá con Buscar. Ajustá el precio máximo sin mover el mapa automáticamente.',
    href: '/',
  },
  {
    title: 'Entender el precio',
    text: 'Abrí la propiedad ficticia destacada. Identificá moneda, alquiler mensual, expensas, depósito y qué incluye el subtotal de ingreso. ¿Podés explicarlo sin ayuda?',
    href: '/#propiedad=201',
  },
  {
    title: 'Explorar el ambiente',
    text: 'Mirá la foto y el panorama 360°. Verificá si queda claro que es un ambiente ficticio generado para la demo, no una propiedad real.',
    href: '/#propiedad=201',
  },
  {
    title: 'Hacer una consulta de prueba',
    text: 'Completá el formulario con datos ficticios. Verificá el aviso de que se guarda en el navegador y no envía un mensaje externo.',
    href: '/#propiedad=201',
  },
  {
    title: 'Trabajar como inmobiliaria',
    text: 'En Consultas, encontrá tu consulta. Cambiá su seguimiento y agendá una visita futura. Luego comprobala en Visitas.',
    href: '/panel',
  },
  {
    title: 'Publicar y recuperar una búsqueda',
    text: 'Creá una propiedad de ejemplo, guardala como borrador y después publicala. Comprobala en el listado público. Probá una búsqueda sin resultados y quitá una condición.',
    href: '/panel',
  },
];
type Result = { status: 'pending' | 'passed' | 'issue'; note: string };

export default function DemoWalkthrough() {
  const {agency, publicPath, catalog} = useDemo();
  const key = agency.id === 'principal' ? 'territorio-user-trial-v1' : `territorio-user-trial-${agency.id}`;
  const featuredId = catalog.find(p => p.id === 201)?.id ?? catalog[0]?.id;
  const taskPath = (path: string) => path === '/' ? publicPath : path === '/panel' ? `${publicPath}/panel` : featuredId ? `${publicPath}#propiedad=${featuredId}` : publicPath;
  const [results, setResults] = useState<Result[]>(
    tasks.map(() => ({ status: 'pending', note: '' })),
  );
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      if (
        Array.isArray(raw) &&
        raw.length === tasks.length &&
        raw.every(
          (value) =>
            ['pending', 'passed', 'issue'].includes(value.status) &&
            typeof value.note === 'string',
        )
      )
        setResults(raw);
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(results));
      } catch {}
  }, [results, ready]);
  const update = (index: number, patch: Partial<Result>) =>
    setResults((values) =>
      values.map((value, i) => (i === index ? { ...value, ...patch } : value)),
    );
  return (
    <main className="trial-page">
      <header>
        <Link href={publicPath}>← Volver al buscador</Link>
        <Link href={`${publicPath}/panel`}>Panel inmobiliaria</Link>
      </header>
      <section className="trial-intro">
        <p>Prueba guiada de la maqueta</p>
        <h1>Probalo como lo usarías vos.</h1>
        <p>
          Esta guía sirve para probar el recorrido con una inmobiliaria y
          personas que buscan departamentos. No registra una prueba
          automáticamente: cada persona marca lo que pudo hacer y anota dónde
          necesitó ayuda.
        </p>
        <strong>
          {results.filter((result) => result.status === 'passed').length} de{' '}
          {tasks.length} tareas marcadas como realizadas
        </strong>
        <span>
          Notas locales en este navegador. Sin envío de datos ni métricas de
          personas reales.
        </span>
      </section>
      <div className="trial-tasks">
        {tasks.map((task, index) => (
          <article key={task.title}>
            <div>
              <b>{index + 1}</b>
              <h2>{task.title}</h2>
            </div>
            <p>{task.text}</p>
            <Link href={taskPath(task.href)} target="_blank" rel="noopener noreferrer">
              Abrir paso en otra pestaña ↗
            </Link>
            <fieldset>
              <legend>¿Cómo te fue?</legend>
              {(
                [
                  { value: 'pending', label: 'Todavía no lo probé' },
                  { value: 'passed', label: 'Pude hacerlo' },
                  { value: 'issue', label: 'Me costó / necesito ayuda' },
                ] as const
              ).map((choice) => (
                <label key={choice.value}>
                  <input
                    type="radio"
                    name={`task-${index}`}
                    checked={results[index].status === choice.value}
                    onChange={() => update(index, { status: choice.value })}
                  />
                  {choice.label}
                </label>
              ))}
            </fieldset>
            <label className="trial-note">
              ¿Qué cambiarías para que sea más claro?
              <textarea
                rows={3}
                value={results[index].note}
                onChange={(event) =>
                  update(index, { note: event.target.value })
                }
              />
            </label>
          </article>
        ))}
      </div>
      <footer>
        Una prueba pendiente no es una validación de usabilidad. Revisá también
        celular, zoom de texto y navegación con teclado.
      </footer>
    </main>
  );
}
