// Datos de ejemplo que se fijan (pin) en los bloques de IA y de Gmail para la demo en pantalla.
// Solo se usan en la copia «demo simulada»; los archivos que se entregan no llevan datos fijados.
const L = (...lines) => lines.join('\n');
const enviado = (n) => [{ id: `demo-simulado-${n}`, threadId: `demo-simulado-${n}`, labelIds: ['SENT'] }];
const correo = (n, From, Subject, snippet) => ({ id: `demo-${n}`, threadId: `demo-${n}`, snippet, From, To: 'yo@example.com', Subject });

module.exports = {
  '1-recepcionista-ia': {
    nota: 'Para probarlo: pulsa **Execute workflow**, abre la página de contacto, pulsa el ejemplo **Precios** y envía. La respuesta fijada corresponde a ese ejemplo, así que saldrá la misma con cualquier otra consulta.',
    pin: {
      agente: [
        {
          output: {
            categoria: 'precios',
            urgencia: 'normal',
            asunto: 'Precio y horario del curso de Excel',
            respuesta: L(
              'Hola, Ana:',
              '',
              'Gracias por escribirnos. El curso de Excel y análisis de datos dura 6 semanas y cuesta 190 €. Las clases son los lunes y miércoles de 18:00 a 20:00, presenciales u online en directo, y quedan grabadas.',
              '',
              'Al estar en paro tienes un 10 % de descuento, así que se quedaría en 171 €. La matrícula son 30 €, y es gratis si la formalizas con más de 15 días de antelación.',
              '',
              'Los cursos empiezan el primer lunes de cada mes. Si quieres reservar plaza, contesta a este correo o llámanos al 910 000 000.',
              '',
              'Lucía · Academia Lumen',
            ),
            resumen_interno: 'Pregunta por el precio y el horario del curso de Excel y por el descuento para personas desempleadas. Conviene llamarla para reservar plaza.',
          },
        },
      ],
      gmailAlumno: enviado(1),
      gmailSecretaria: enviado(2),
    },
  },

  '2-redactor-de-posts': {
    nota: 'Para probarlo: pulsa **Execute workflow**, abre la mini-web, elige el tema **Inteligencia artificial en la educación** y envía. Los titulares son reales (se piden a Google Noticias); si no hay internet, el post sale igual, sin titulares. El post es el ejemplo fijado.',
    pin: {
      agente: [
        {
          output: L(
            '¿Y si la inteligencia artificial fuera la mejor compañera de estudio de tus alumnos?',
            '',
            'Cada semana aparecen herramientas nuevas y es fácil sentir que vamos tarde. Pero la pregunta importante no es qué herramienta usar, sino para qué.',
            '',
            'En clase, la IA puede explicar un concepto de tres formas distintas, proponer ejercicios a medida o dar una primera corrección en segundos. Eso deja más tiempo para lo que ninguna máquina hace: escuchar, motivar y acompañar.',
            '',
            'Mi consejo para empezar: elige una sola tarea repetitiva de tu semana y prueba a hacerla con ayuda de la IA. Mide el tiempo que ahorras y decide después.',
            '',
            'La tecnología no sustituye a quien enseña; le devuelve tiempo para enseñar mejor.',
            '',
            '¿Qué tarea de tu día a día le dejarías a la IA mañana mismo?',
            '',
            '#InteligenciaArtificial #Educación #Formación #Docentes',
          ),
        },
      ],
      gmail: enviado(3),
    },
  },

  '3-resumen-varios-gmail': {
    nota: 'Para probarlo: pulsa **Execute workflow**. Los correos de las dos cuentas son inventados y el resumen es el ejemplo fijado.',
    pin: {
      gmail1: [
        correo('p1', 'Marta Ruiz <marta.ruiz@example.com>', 'Entrega del trabajo final: mañana a las 12:00', 'Hola, te recuerdo que la entrega del trabajo final del curso es mañana antes de las 12:00. Súbelo al campus en PDF.'),
        correo('p2', 'Administración de fincas <administracion@fincas.example>', 'Junta de vecinos el jueves 19 a las 19:30', 'Se convoca junta ordinaria el jueves 19 a las 19:30 en el portal. Por favor, confirma si vas a asistir.'),
        correo('p3', 'Luz Ejemplo <facturas@luz.example>', 'Tu factura de noviembre ya está disponible', 'Importe: 48,20 €. Se cargará en tu cuenta el día 20. Puedes descargarla desde tu área de cliente.'),
      ],
      gmail2: [
        correo('t1', 'Javier Soto <javier.soto@empresa.example>', 'Necesito el informe de ventas hoy antes de las 17:00', 'Hola, el cliente ha adelantado la reunión. ¿Puedes enviarme el informe de ventas de octubre hoy antes de las 17:00?'),
        correo('t2', 'Laura Peña <laura.pena@empresa.example>', '¿Te va bien reunirnos el viernes a las 10:00?', 'Es para revisar el calendario del proyecto. Dime si te encaja o propón otra hora.'),
        correo('t3', 'Recursos Humanos <rrhh@empresa.example>', 'Calendario laboral de 2027', 'Ya está publicado en la intranet el calendario laboral del próximo año.'),
      ],
      agente: [
        {
          output: L(
            '<p>Hoy hay dos cosas con plazo: Javier necesita el informe de ventas antes de las 17:00 y mañana a las 12:00 vence la entrega del trabajo final.</p>',
            '<h3>Personal</h3>',
            '<p><strong>Urgente</strong></p>',
            '<ul><li>Marta Ruiz recuerda que la entrega del trabajo final es mañana antes de las 12:00, en PDF y por el campus.</li></ul>',
            '<p><strong>Pendiente de responder</strong></p>',
            '<ul><li>La administración de fincas convoca junta de vecinos el jueves 19 a las 19:30 y pide confirmar asistencia.</li></ul>',
            '<p><strong>Para tu información</strong></p>',
            '<ul><li>Luz Ejemplo avisa de que la factura de noviembre (48,20 €) se cargará el día 20.</li></ul>',
            '<h3>Trabajo</h3>',
            '<p><strong>Urgente</strong></p>',
            '<ul><li>Javier Soto pide el informe de ventas de octubre hoy antes de las 17:00, porque el cliente ha adelantado la reunión.</li></ul>',
            '<p><strong>Pendiente de responder</strong></p>',
            '<ul><li>Laura Peña propone reunirse el viernes a las 10:00 para revisar el calendario del proyecto.</li></ul>',
            '<p><strong>Para tu información</strong></p>',
            '<ul><li>Recursos Humanos ha publicado en la intranet el calendario laboral de 2027.</li></ul>',
          ),
        },
      ],
      enviar: enviado(4),
    },
  },
};
