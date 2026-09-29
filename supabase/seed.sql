insert into public.training_modules (title, description, content, order_index, active)
values
  ('Bienvenida a MK Dev Studio', 'Contexto de cultura, tono y expectativas.', 'MK Dev Studio ayuda a negocios a vender, operar y crecer con soluciones digitales prácticas. El agente debe escuchar primero, calificar bien y documentar cada paso.', 1, true),
  ('Quiénes somos', 'Servicios, posicionamiento y tipo de cliente ideal.', 'MKD desarrolla sitios web, software a medida, aplicaciones, SaaS, POS, e-commerce, integraciones, hosting, mantenimiento, SEO y soporte tecnológico.', 2, true),
  ('Qué vendemos', 'Oferta principal y cuándo escalar a revisión técnica.', 'Vende resultados consultivos: presencia web, automatización, ventas online, operación más clara y soporte. SaaS, apps e integraciones críticas se escalan a Maikel.', 3, true),
  ('Por qué un negocio necesita una web', 'Argumentos comerciales base.', 'Una web profesional centraliza confianza, información, captación, catálogo, medición y cierre. No se prometen ventas garantizadas ni primera posición en Google.', 4, true),
  ('Cómo encontrar prospectos', 'Búsqueda inicial de leads.', 'Prioriza negocios con actividad, necesidad visible, mala experiencia digital o fricción para vender por redes. Registra todo en el CRM antes de avanzar.', 5, true),
  ('Cómo usar el CRM', 'Registro y seguimiento.', 'Cada lead debe tener estado, próxima acción, fecha de seguimiento, servicio solicitado y notas claras. Un lead ganado requiere pago o anticipo confirmado.', 6, true),
  ('Manejo de objeciones', 'Respuestas iniciales.', 'Responde con calma, valida la preocupación y vuelve al problema de negocio. Si piden descuentos o alcance especial, solicita aprobación.', 7, true),
  ('Primeros días del agente', 'Ruta inicial de operación.', 'Lee el manual, revisa precios, practica guiones, registra prospectos reales y reporta dudas u obstáculos diariamente.', 8, true)
on conflict do nothing;

insert into public.scripts (title, category, content, active)
values
  ('Primer mensaje para restaurante', 'Primer mensaje restaurante o comida', 'Hola, vi su restaurante y creo que podrían captar más pedidos y reservas con una web clara, rápida y conectada a WhatsApp. ¿Les interesa que les comparta una idea sencilla?', true),
  ('Primer mensaje para tienda', 'Primer mensaje tienda o negocio general', 'Hola, vi su negocio y me llamó la atención lo que ofrecen. En MK Dev Studio ayudamos a convertir redes y catálogos en una web profesional para vender mejor. ¿Puedo hacerles una recomendación rápida?', true),
  ('Seguimiento sin respuesta', 'Seguimiento si no responde', 'Hola, paso a dar seguimiento. La idea no es presionar, solo saber si les interesa revisar una opción para mejorar presencia digital y captar clientes con una web profesional.', true),
  ('Respuesta con interés', 'Respuesta cuando muestra interés', 'Excelente. Para orientarte bien: ¿qué servicio ofrecen, qué problema quieren resolver primero y si ya tienen una idea de presupuesto o fecha?', true),
  ('Proponer llamada', 'Mensaje para proponer llamada', 'Creo que vale la pena verlo en una llamada breve para entender alcance y confirmar si conviene landing, web corporativa, tienda o algo más a medida. ¿Qué horario te funciona?', true),
  ('Objeción precio', 'Objeciones frecuentes', 'Te entiendo. Nuestros precios son “desde” porque dependen del alcance real. Podemos revisar una opción inicial sin prometer descuentos ni funciones fuera de alcance.', true)
on conflict do nothing;

insert into public.documents (title, category, url, description, version, visible_to_agents)
values
  ('Servicios Profesionales MK Dev', 'Servicios', 'https://example.com/servicios-mk-dev', 'Documento base de servicios ofrecidos por MK Dev Studio.', '1.0', true),
  ('Manual de Ventas MK Dev Studio', 'Ventas', 'https://example.com/manual-ventas-mkd', 'Manual operativo para agentes comerciales.', '1.0', true),
  ('Proceso de ventas', 'Proceso', 'https://example.com/proceso-ventas', 'Pasos del proceso comercial y reglas de cierre.', '1.0', true),
  ('Documento de precios', 'Precios', 'https://example.com/precios', 'Tabla interna de precios referenciales. Validar antes de publicación final.', '1.0', true),
  ('Portafolio', 'Portafolio', 'https://example.com/portafolio', 'Enlace de referencia para mostrar trabajos y capacidades.', '1.0', true),
  ('Checklist de cierre', 'Cierre', 'https://example.com/checklist-cierre', 'Lista de validación antes de marcar una venta como ganada.', '1.0', true)
on conflict do nothing;

insert into public.settings (key, value)
values
  ('pricing_notice', '{"message":"Validar precios oficiales antes de publicación comercial final"}'),
  ('default_sergio_commission', '{"commission_rate":0.30,"future_note":"Base de 200 USD + 20% comisión es posibilidad futura, no promesa."}')
on conflict (key) do update set value = excluded.value;
