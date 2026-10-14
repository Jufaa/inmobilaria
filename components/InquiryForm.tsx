'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useDemo } from './DemoProvider';
import type { Property } from '@/lib/properties';
export default function InquiryForm({ property }: { property: Property }) {
  const { addLead, storageMessage, ready } = useDemo();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(
    `Me interesa ${property.title}. Quisiera recibir más información.`,
  );
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <div className="inquiry-success" role="status">
        <h3>Tu consulta quedó en la demo</h3>
        <p>
          {storageMessage
            ? 'La consulta está disponible en esta sesión; el navegador no pudo guardarla de forma persistente.'
            : 'Se guardó en este navegador.'}{' '}
          No se envió un correo ni un mensaje externo.
        </p>
        <Link href="/panel">Ver consulta en Panel inmobiliaria</Link>
      </div>
    );
  return (
    <form
      className="inquiry-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          !name.trim() ||
          (!email.trim() && !phone.trim()) ||
          !message.trim()
        ) {
          setError('Completá tu nombre, un medio de contacto y el mensaje.');
          return;
        }
        addLead({
          propertyId: property.id,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          message: message.trim(),
        });
        setSent(true);
      }}
    >
      <h3>Consultá por esta propiedad</h3>
      <p>Formulario de prueba: se guarda solo en este navegador.</p>
      <label>
        Tu nombre
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={200}
        />
      </label>
      <label>
        Teléfono
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          maxLength={40}
        />
      </label>
      <label>
        Mensaje
        <textarea
          required
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={2000}
        />
      </label>
      {error && (
        <p className="admin-errors" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button" type="submit" disabled={!ready}>
        Enviar consulta de prueba
      </button>
    </form>
  );
}
