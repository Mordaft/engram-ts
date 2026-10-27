Skip to main contentAccessibility help
AI Mode
All
Images
Videos
News
More
Pro




Quiero entender el funcionamiento de engram de gentleman-programming, que definición realiza para que los agentes utilicen esa memoria basada en busqueda de texto.
Engram, desarrollado por Alan Buscaglia (Gentleman Programming), es un sistema de memoria persistente diseñado específicamente para agentes de desarrollo de software con Inteligencia Artificial (como Claude Code, OpenCode o Cursor). Su objetivo fundamental es evitar que la IA "olvide" las decisiones de arquitectura, convenciones o la resolución de bugs cada vez que finaliza una sesión de terminal. 

GitHub
 +3
Para lograr que los agentes utilicen esta memoria basada en búsqueda de texto puro (búsqueda léxica, no vectorial), Engram realiza una definición clave estructurada en dos pilares: el protocolo de comunicación MCP (Model Context Protocol) y un esquema rígido de resúmenes estructurados.
1. ¿Cómo se define el puente? El servidor MCP
Engram se expone a los agentes de IA actuando principalmente como un servidor MCP. MCP es un estándar abierto desarrollado por Anthropic que permite a los LLMs interactuar con herramientas del sistema de manera unificada. 

jacar.es
 +1
Al iniciar, Engram inyecta en el agente herramientas específicas (tools) descritas mediante JSON Schema. Las más importantes en su arquitectura son: 

YouTube
mem_save: Definida con parámetros estrictos para que el agente guarde la información de manera limpia.
mem_search / mem_query: La definición que permite al agente buscar texto en la base de datos local usando palabras clave o comandos específicos. 

Go Packages
 +1
2. La definición del formato: "Señales estructuradas", no volcados de texto
La clave de la memoria basada en búsqueda de texto es que no almacena todo el historial de la conversación (lo cual saturaría la ventana de contexto de la IA). Engram define e instruye al agente a empaquetar la memoria en un resumen curado y estructurado justo al completar un hito o antes de que ocurra una compactación de contexto. 

Pi Agent
 +2
Cuando el agente invoca la definición para guardar, debe proveer un formato estricto: 

GitHub
title (Título): Una frase corta y descriptiva usando palabras clave explícitas (ej: "Fixed N+1 query in user list" o "Clean Architecture rule for repositories"). 

GitHub
type (Tipo): Clasificadores predefinidos (ej: bugfix, architecture, convention). 

GitHub
project: Forzado en versiones recientes para garantizar que el contexto pertenezca estrictamente al repositorio actual. 

X
·G_Programming
 +1
content (Contenido): Redactado bajo un patrón de ingeniería de prompts integrado en la herramienta: ¿Qué se hizo?, ¿Por qué se hizo? y ¿Qué se aprendió? 

GitHub
3. El motor de búsqueda por debajo: SQLite + FTS5
Al descartar las bases de datos vectoriales (que requieren modelos de embeddings externos, consumen más recursos y a veces sufren de imprecisiones semánticas), Engram utiliza un motor nativo y local: SQLite con la extensión FTS5 (Full-Text Search). 

siemprelisto.cl
 +1
Búsqueda Léxica: Cuando el agente inicializa una nueva sesión, se le instruye sistemáticamente a realizar una búsqueda rápida en la memoria. 

Pi Agent
 +1
El flujo de coincidencia: El agente genera términos de búsqueda basados en la tarea asignada. El motor FTS5 de la base de datos local (~/.engram/engram.db) escanea instantáneamente los campos indexados de texto por coincidencias exactas o de prefijos. 

jacar.es
 +1
Resumen del ciclo de funcionamiento
El agente trabaja: Resuelve un problema de código.
El agente sintetiza: Ejecuta la función interna del servidor MCP enviando un bloque estructurado de texto conciso.
Engram indexa: Guarda ese registro en SQLite usando el motor FTS5.
Próxima sesión: El agente arranca consultando a Engram mediante una búsqueda de texto sobre el tema de su tarea, recuperando únicamente la memoria relevante sin desperdiciar tokens. 

Pi Agent
 +2
Para inspeccionar la arquitectura en profundidad, puedes consultar los detalles directamente en el repositorio oficial de Gentleman-Programming/engram en GitHub. 
Si estás integrando esta herramienta, dime:
¿Qué agente de IA estás utilizando actualmente (Claude Code, Cursor, OpenCode, etc.)?
¿Quieres saber cómo configurar el archivo del servidor MCP para enlazar tu agente con Engram?
AI responses may include mistakes. Learn more




Pi Agent
gentle-engram · Packages - Pi coding agent
Token-efficient by design — Engram stores curated summaries, decisions, prompts, and session handoffs instead of a noisy firehose ...


GitHub
Gentleman-Programming/engram at jonathancanales.com
Contributing Dashboard contributors: if you modify . templ files in internal/cloud/dashboard/ , run make templ to regenerate befor...


Go Packages
engram command - github.com/Gentleman-Programming ...
Engram — Persistent memory for AI coding agents. Usage: engram serve Start HTTP + MCP server engram mcp Start MCP server only (std...
pero como sabe la ia utilizar esos metodos concretos publicados con interfaz mcp
La IA sabe exactamente cómo y cuándo utilizar las herramientas de Engram porque el servidor MCP le auto-explica sus capacidades mediante un manifiesto JSON Schema, y el sistema del agente inyecta estas capacidades directamente en el "bucle de pensamiento" del modelo (el ciclo System Prompt -> Tool Call -> Tool Response).
Aquí te explico el mecanismo técnico paso a paso de cómo ocurre esta "magia":
1. El protocolo de descubrimiento (List Tools)
Cuando inicias tu agente de IA (por ejemplo, Claude Code o Cursor) y este arranca el servidor de Engram, lo primero que hace el agente es enviar una petición estandarizada de MCP llamada tools/list.
Engram responde con una definición formal de sus métodos utilizando JSON Schema. No solo le dice el nombre del método, sino que le describe textualmente para qué sirve y qué parámetros exactos necesita.
Una definición simplificada de lo que recibe la IA se ve así:
json
{
  "name": "mem_search",
  "description": "Busca en la memoria persistente del desarrollador sobre decisiones pasadas, arquitecturas o bugs resueltos. Úsala al iniciar una tarea para comprobar si ya se resolvió algo similar.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Términos de búsqueda de texto o palabras clave relacionadas con la tarea (ej: 'auth bypass', 'prisma configuration')."
      },
      "project": {
        "type": "string",
        "description": "El nombre del proyecto actual para filtrar los resultados relevantes."
      }
    },
    "required": ["query"]
  }
}
Use code with caution.
2. La inyección en el contexto (System Prompt dinámico)
El cliente de IA toma este JSON y lo concatena internamente en las instrucciones del sistema (System Prompt) antes de que tú escribas tu primer mensaje.
Para la IA, estas herramientas publicadas por el protocolo MCP se convierten en "superpoderes" o verbos que tiene permitidos ejecutar. El modelo subyacente (como Claude 3.5 Sonnet o Claude 3.7) ha sido entrenado fuertemente por Anthropic para reconocer este formato y entender que, si se topa con un problema que coincide con la descripción de una herramienta, debe pausar la generación de texto y llamar a la herramienta.
3. El bucle de ejecución (El Agente en acción)
Cuando tú le pides algo al agente, el proceso mental de la IA sigue este flujo lógico:
Lectura de la petición: El usuario dice: "Arregla el problema con los tokens de JWT que expiran pronto".
Razonamiento interno: La IA piensa: "Tengo una instrucción en mi sistema que dice que antes de escribir código debo buscar si hay registros pasados. Además, tengo una herramienta llamada mem_search cuya descripción dice que busca bugs resueltos pasados sobre configuraciones."
Generación de la llamada (Tool Call): En lugar de responderte a ti con texto normal, la IA emite un formato especial estructurado:
json
{
  "call": "mem_search",
  "arguments": { "query": "JWT token expiration", "project": "mi-app-backend" }
}
Use code with caution.
Intersección del cliente: El software del agente (ej. Claude Code) ve ese JSON, detiene la respuesta, ejecuta el código de Engram pasándole los argumentos, y le devuelve el texto plano que encontró en SQLite a la IA.
Respuesta final: La IA lee los datos recuperados por Engram y te dice: "He encontrado en tu memoria que el 14 de marzo ya corregiste esto cambiando la variable de entorno X. Procedo a replicar la solución..."
En resumen
La IA no adivina. El estándar MCP obliga a Engram a entregar un manual de instrucciones de sus propios métodos en un formato que las IAs entienden a la perfección. El modelo de lenguaje simplemente decide usar el método mem_search o mem_save porque lee en sus descripciones que son los caminos más eficientes para resolver tu petición.
¿Te gustaría ver el código real de Engram donde define estas herramientas para entender cómo Alan estructuró las descripciones que lee la IA, o prefieres ver cómo configurar tu agente para que empiece a leer el servidor MCP?
AI responses may include mistakes. Learn more



como funciona el uso de mcps locales, la herramienta (hardness) que envia la petición al modelo usando el api compatible OpenAI que informa para que ese LLM pueda decirdir , uso este método de este MCP ?
Para entender cómo un LLM decide usar un método de un MCP local cuando se consume a través de una API compatible con OpenAI (el software intermediario o "harness" que mencionas), hay que mirar el flujo de traducción que hace la herramienta que ejecuta al agente en tu máquina local. 

Medium
·Al Amin Chayan
 +1
El LLM en sí no sabe qué es un MCP ni habla el protocolo MCP directamente. Es la herramienta local (el harness o cliente MCP, como OpenCode, Claude Code o un script puente personalizado) la que actúa como traductor universal. 

Google Cloud
 +2
Así funciona el mecanismo exacto por el cual la herramienta informa al LLM para que este tome la decisión:
1. El Puente: Mapeo de MCP a tools de OpenAI
La API de OpenAI (y las compatibles) no entienden el protocolo MCP, pero sí tienen una funcionalidad nativa y muy potente llamada Function Calling o Tools (tools: [...] en el cuerpo del JSON que se envía a la API). 

OpenAI Developers
Cuando arrancas el agente local, el harness realiza este proceso interno antes de enviar tu mensaje al modelo:
El harness local levanta el servidor de Engram en segundo plano (generalmente por comunicación de procesos stdio). 
Llama al servidor MCP y le pide la lista de herramientas disponibles mediante el estándar MCP (tools/list). Engram le devuelve sus métodos (mem_search, mem_save, etc.) en formato JSON Schema. 

GitHub
 +2
La Traducción: El harness toma esos esquemas de MCP y los formatea exactamente dentro del arreglo tools que exige la API compatible con OpenAI. 

OpenAI Developers
 +1
2. ¿Cómo se le informa al LLM para que decida?
Cuando haces una pregunta, el harness local envía una petición HTTP POST a la API compatible con OpenAI. El cuerpo del JSON que viaja a internet (o a tu modelo local) contiene dos cosas cruciales:
Tus mensajes (messages): Tu prompt (ej: "Busca si ya solucionamos el bug del JWT").
Las herramientas (tools): El catálogo traducido de Engram. 

Medium
·Al Amin Chayan
El LLM recibe todo esto en su ventana de contexto. Al procesar el texto, el modelo evalúa probabilísticamente tu petición contra las descripciones semánticas de las herramientas que le adjuntaron. Si ve que tu prompt pide "buscar" o "recordar", y lee en la descripción de la herramienta de Engram que mem_search sirve exactamente para eso, el cerebro del LLM toma la decisión. 

Medium
3. El Momento de la Decisión (El retorno de la API)
El LLM no ejecuta código. El modelo simplemente responde con un JSON especial bajo el parámetro tool_calls. La API compatible con OpenAI te devuelve algo como esto: 

OpenAI Developers
json
{
  "finish_reason": "tool_calls",
  "message": {
    "role": "assistant",
    "tool_calls": [
      {
        "id": "call_12345",
        "type": "function",
        "function": {
          "name": "mem_search",
          "arguments": "{\"query\": \"JWT bug\", \"project\": \"mi-app\"}"
        }
      }
    ]
  }
}
Use code with caution.
4. La Ejecución Local
Aquí es donde el harness local vuelve a tomar el control absoluto: 

primacy.com
 +1
Intercepta esa respuesta de la API de OpenAI y ve que el modelo "quiere" usar mem_search.
El harness local toma los argumentos provistos por la IA y hace la petición real al servidor local de Engram (vía JSON-RPC sobre stdio).
Engram busca en SQLite (FTS5) y le devuelve el texto plano al harness.
El harness crea un nuevo mensaje con el rol tool conteniendo la respuesta de Engram y vuelve a enviar una petición a la API de OpenAI para que el modelo finalmente lea la memoria y redacte la respuesta final para ti. 

GitHub
 +5
En conclusión: El LLM decide basándose puramente en la coincidencia semántica entre tu prompt y las descripciones de las herramientas inyectadas en la llamada de la API de OpenAI. El truco está en el cliente local (harness), que disfraza los métodos de Engram como funciones estándar de OpenAI antes de mandárselos al modelo. 

OpenAI Developers
 +2
¿Qué harness o cliente local estás utilizando para conectar este flujo (por ejemplo, el plugin de OpenCode, Roo Code, o un backend propio en Node/Python)? Si me das ese detalle, podemos ver cómo está estructurado el archivo de configuración para asegurar que las tools se inyecten correctamente.
AI responses may include mistakes. Learn more




GitHub
GitHub - Gentleman
GitHub - Gentleman-Programming/engram: Persistent memory system for AI coding agents. Agent-agnostic Go binary with SQLite + FTS5,


Medium
MCP for LLMs: How Does the Model Know Which Tool to Use?
MCP format Key idea: the MCP Server does not decide what to run. Just like your microservice does not guess which endpoint the cli...


OpenAI Developers
MCP servers | OpenAI API
Step 2: Calling tools. Once the model has access to these tool definitions, it may choose to call them depending on what's in the ...

bien, entonces que envia el harness para que el modelo sepa que tiene disponible esa tool?
El harness envía una petición HTTP POST al endpoint de la API (generalmente /v1/chat/completions). Dentro del cuerpo (el JSON) de esa petición, el harness incluye un parámetro clave llamado tools.
Este parámetro contiene un array de objetos donde se describe detalladamente cada función disponible del MCP (en este caso, los métodos de Engram).
Aquí tienes el ejemplo exacto de qué JSON envía el harness para que el modelo sepa que tiene disponible la herramienta de búsqueda de Engram:
json
{
  "model": "gpt-4o", 
  "messages": [
    {
      "role": "user",
      "content": "¿Cómo configuramos la base de datos la última vez? No lo recuerdo."
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "mem_search",
        "description": "Busca en la memoria persistente del desarrollador sobre decisiones pasadas, arquitecturas o bugs resueltos. Úsala siempre que el usuario te pida recordar, buscar soluciones anteriores o al iniciar el contexto de una tarea.",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "Términos de búsqueda de texto o palabras clave relacionadas con la tarea (ej: 'database setup', 'prisma configuration')."
            },
            "project": {
              "type": "string",
              "description": "El nombre del proyecto o repositorio actual para filtrar los recuerdos correspondientes."
            }
          },
          "required": ["query", "project"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
Use code with caution.
Los 3 elementos que el modelo analiza para decidir:
name (mem_search): Es el identificador único. El modelo no lo ejecuta, pero lo usará para decirte "quiero ejecutar este nombre".
description: Esto es lo más importante para la IA. Es texto en lenguaje natural dirigido al "cerebro" del LLM. El modelo lee esa descripción y la contrasta con el mensaje del usuario. Al ver que el usuario dice "No lo recuerdo", la IA asocia probabilísticamente que la herramienta diseñada para "cuando el usuario te pida recordar" es la candidata perfecta.
parameters: Es el formato (JSON Schema) que el modelo está obligado a rellenar si decide usar la herramienta. Le indica qué variables necesita (como la query) y de qué tipo deben ser (un string).
Gracias a este envío, el LLM procesa tu pregunta teniendo pleno conocimiento de que cuenta con ese "superpoder" local llamado mem_search y sabe exactamente cómo estructurar la petición de vuelta para que tu harness la ejecute en tu base de datos SQLite local.
AI responses may include mistakes. Learn more



entonces en el repositorio engram debería poder encontrar esa definición "tools" , no?
Sí, absolutamente. En el repositorio de Gentleman-Programming/engram, encontrarás exactamente el código y los esquemas JSON que definen estas herramientas. Como Engram está desarrollado principalmente en Go, verás estas definiciones escritas en este lenguaje, estructuradas bajo el protocolo MCP.
Si inspeccionas el código en su documentación técnica (DOCS.md) y en el código del servidor, verás que implementa un catálogo con 27 herramientas MCP en total. 

GitHub
¿Dónde encontrar la definición en el código?
Si exploras los archivos del repositorio, la lógica se divide principalmente en estas secciones:
La definición del contrato MCP (Go):
Dentro del directorio que maneja el servidor MCP (habitualmente en rutas como internal/mcp/ o los setups de plugins como plugin/), vas a encontrar estructuras en Go donde se definen los objetos que el servidor expondrá al cliente. Para cada herramienta como mem_search o mem_save, los desarrolladores declaran un objeto que contiene:
El Name (nombre textual de la función).
La Description (el texto largo explicativo que la IA lee para decidir usarla).
El InputSchema (las propiedades que la IA debe rellenar, como query, project, etc.). 

GitHub
 +2
Las instrucciones de comportamiento para el Agente:
Además de la pura definición técnica de la herramienta, Engram incluye archivos Markdown especiales en su repositorio (por ejemplo, dentro de plugin/codex/skills/memory/SKILL.md o docs/AGENT-SETUP.md). Estos archivos contienen lo que se conoce como Memory Protocol (Protocolo de Memoria): instrucciones directas en lenguaje humano destinadas a ser inyectadas en el Agente (como Claude Code u OpenCode).
Ahí se le dice explícitamente al modelo:
"Al inicio de un trabajo relacionado, usa mem_context y mem_search para recuperar el historial relevante. Busca antes de repetir..."
 

GitHub
 +3
¿Por qué lo verás como código Go y no como un JSON plano?
Porque el servidor MCP de Engram genera el JSON dinámicamente. Cuando el harness local arranca el binario de Engram, el código Go se ejecuta, compila internamente las descripciones y los esquemas definidos en sus funciones y los transmite como un flujo JSON-RPC a través de la consola (stdio) directamente hacia el harness.
De este modo, si necesitas modificar cómo el agente entiende una herramienta o quieres ver qué parámetros acepta exactamente mem_search (como sus filtros por proyecto o su modo de coincidencia léxica FTS5), el lugar correcto es revisar los archivos fuente de la implementación del servidor MCP en el propio repositorio. 

GitHub
 +1
¿Te gustaría que te ayude a localizar una función específica de Go dentro del repositorio o prefieres que revisemos el Memory Protocol (las reglas en Markdown) que le enseñan a la IA a comportarse de forma eficiente con estos comandos?
AI responses may include mistakes. Learn more




GitHub
mem_search returns 0 when no observation contains all query ...
Description * 🔍 Problem Description mem_search returns 0 results for multi-token queries when no single observation contains ever...

GitHub
engram/DOCS.md at main - Gentleman-Programming
Table_title: Quick Navigation Table_content: | Section | What you'll find | | --- | --- | | Database Schema | Tables, FTS5, SQLite...


GitHub
GitHub - Gentleman
Features * Terminal UI — Browse what your agent remembers engram tui Navigate with j / k , use Enter to drill in, c to copy conten...

como usa exactamente el hardness las skills en esa conversacion con el API estandar OpenAI? (es decir hace una gran mensaje con lo que pide el usuario y las skills y las tools?)
El harness local (como Claude Code, OpenCode o el entorno de ejecución del agente) utiliza una estrategia de optimización sumamente inteligente para manejar tanto las Tools de MCP como las Skills (los archivos SKILL.md) en su comunicación con la API estándar. 

OpenAI
 +2
No envía un mensaje masivo e inmanejable con todo el contenido de golpe en cada interacción. En su lugar, aplica una técnica llamada divulgación progresiva (progressive disclosure) para no saturar la ventana de contexto ni desperdiciar tokens. 

iMasters
El harness estructura el mensaje y la conversación en tres niveles bien diferenciados: 

iMasters
Nivel 1: Lo que se envía SIEMPRE en cada petición (MetadadosResidentes)
Cuando tú escribes un prompt, el harness realiza una llamada HTTP POST a la API de OpenAI/Anthropic empaquetando el mensaje en un JSON estándar. En esta primera petición adjunta:
Tu prompt actual: El mensaje del usuario (ej: "Configura una nueva ruta para el login").
Las Tools de MCP (tools: [...]): Una lista compacta de las funciones disponibles de Engram (mem_search, mem_save), que pesan apenas unos cientos de tokens.
Los Metadados de las Skills: El harness escanea la carpeta de skills/ del proyecto. Para cada skill (como testing-coverage, server-api o memory), solo extrae el Nombre (name) y la Descripción (description) de su cabecera. 

OpenAI Developers
 +4
¿Cómo viaja esto? Generalmente, el harness inyecta el catálogo abreviado de las Skills (Nombre + Descripción) directamente en el contexto del prompt del usuario o en las directrices del sistema. De esta forma, el LLM sabe que la Skill existe, pero no ha leído sus reglas internas. 

MindStudio
 +2
Nivel 2: La activación bajo demanda (Lectura del SKILL.md)
Aquí es donde ocurre la magia del agente en bucle (Agent Loop). El modelo recibe el prompt y el catálogo de metadados, procesa la información y toma una decisión: 

OpenAI
 +2
Al leer tu petición sobre "configurar una ruta", el modelo ve en los metadados que existe una skill llamada server-api cuya descripción dice "Úsala al añadir o cambiar rutas HTTP". 

github.com
Como el cuerpo completo de las instrucciones de esa skill no está en el mensaje original, el modelo genera un comando interno (una llamada a una herramienta del sistema provista por el harness) pidiendo leer el archivo SKILL.md específico de esa ruta de la skill. 

OpenAI Developers
El harness intercepta esta petición localmente, abre el archivo skills/server-api/SKILL.md desde tu disco duro, extrae todas las reglas de arquitectura escritas en Markdown y las inyecta en el contexto de la conversación mediante un nuevo turno de mensaje. 

OpenAI Developers
 +2
Nivel 3: El uso de las Tools de Engram para ejecutar la Skill
Ahora el modelo tiene en su "memoria a corto plazo" (el contexto actual de la conversación) las instrucciones detalladas del SKILL.md. 

OpenAI Developers
 +1
El archivo SKILL.md de Engram contiene el Memory Protocol (Protocolo de Memoria), que le dice explícitamente al modelo: "Cuando vayas a aplicar esta regla, primero verifica en la memoria del desarrollador si ya existe un estándar previo". 

GitHub
Al leer su nueva instrucción, el modelo decide invocar la herramienta de MCP correspondiente. 

Harness Developer Hub
Genera un tool_calls solicitando ejecutar mem_search con los parámetros correspondientes. 

MindStudio
El harness ejecuta la consulta en la base de datos local SQLite de Engram y le devuelve el resultado exacto obtenido por búsqueda de texto puro. 

MindStudio
En resumen: ¿Es un gran mensaje único?
No. Es un proceso dinámico y conversacional de ida y vuelta gestionado por el harness: 

MindStudio
[Usuario] ──> (Envía Prompt + Lista básica de Tools y nombres de Skills) ──> [LLM]
                                                                              │ (Ve que necesita una Skill)
[Usuario] <── (El Harness lee localmente el SKILL.md y se lo entrega) <───────┘
  │
  └──> [LLM tiene el SKILL.md] ──> (Pide ejecutar la Tool `mem_search` de MCP) ──> [Harness / Engram DB]
                                                                                         │
[Usuario] <── (Muestra solución final basada en las reglas y la memoria) <───────────────┘
Esta separación en capas es la razón por la que puedes tener docenas de Skills de arquitectura diferentes instaladas en Engram sin destruir la ventana de contexto del LLM ni disparar tus costos de API en la primera pregunta. El harness solo alimenta al modelo con lo que este va pidiendo paso a paso. 

iMasters
 +1
Si estás diseñando tus propias reglas de desarrollo, dime:
¿Quieres ver cómo escribir el bloque de metadados (frontmatter) en un archivo SKILL.md propio para que el harness lo reconozca correctamente?
¿Te gustaría analizar un ejemplo de regla de arquitectura (guardrail) de Engram para ver cómo se redactan estas instrucciones orientadas a agentes?
AI responses may include mistakes. Learn more




MindStudio
What Is a Harness? The Infrastructure That Turns AI Models ...
Tool Definitions and Execution The most important job of a harness is giving the model access to tools — and actually running them...


OpenAI Developers
Skills | OpenAI API
Skills in the user prompt. For Responses API shell tools, the platform adds each available skill's name , description , and path t...


iMasters
Agent Skills (Claude): como criar, instalar e versionar | iMasters
Os três níveis de carregamento A documentação chama isso de progressive disclosure, e é o conceito que sustenta toda a proposta de...

Estoy pensado en crear una librería engram-ts para usarla en una aplicación que he creado que hacer revisiones de código. En esa aplicación utilizo lang graph para revisar cada fichero completo incluido en una MR/PR (Gitlab/Github). Mi idea es que esa librería usará IndexedDB con Dexie y LunarJS para creará una tabla para almacenar el razonamiento y/o conversación del análisis de código de ficheros previos, desde LangGraph quiero usar esa librería de forma similar a como trabaja un mcp de forma similar a lo que plantea Gentle-Programming.
¡Es una idea brillante! Estás adaptando el concepto de persistencia local y búsqueda léxica ligera de Engram al ecosistema del navegador y de Node/Edge usando herramientas perfectas para ello. Dexie.js (IndexedDB) te dará la robustez transaccional y el almacenamiento persistente, mientras que Lunr.js emulará perfectamente el comportamiento de búsqueda de texto completo (FTS5) que Engram hace con SQLite.
Dado que vas a usar LangGraph, no necesitas montar un servidor de procesos stdio (como el MCP nativo), sino que puedes abstraer tu librería engram-ts como una herramienta nativa de LangChain/LangGraph (una Tool o un nodo de memoria encapsulado).
1. Arquitectura de la Solución: ¿Cómo encaja todo?
En LangGraph, cada archivo de la Pull Request se procesará en un ciclo o a través de un grafo de mapeo (Map-Reduce). Tu librería engram-ts actuará como un almacén de contexto indexable.
[LangGraph: Inicio de PR]
          │
          ├──> [Para cada Archivo en la MR]
          │          │
          │          ├──> 1. LLAMADA LÉXICA: engram.search("patrones del archivo/modulo")
          │          │          └──> Recupera razonamientos de archivos previos ya analizados
          │          │
          │          ├──> 2. REVISIÓN: LLM analiza el archivo + contexto recuperado
          │          │
          │          └──> 3. GUARDADO: engram.save(razonamiento, meta: { file, component, tech })
          │
[LangGraph: Fin de PR]
2. El Contrato de las Herramientas (La interfaz que verá el LLM)
Para que tu aplicación de LangGraph exponga engram-ts de forma idéntica a como lo plantea Gentleman-Programming, debes empaquetar los métodos de tu librería como herramientas de LangChain (@langchain/core/tools).
Así es como estructurarías la definición semántica (el equivalente al JSON del MCP) en TypeScript:
typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { EngramClient } from "engram-ts"; // Tu librería

const engram = new EngramClient(); // Inicializa Dexie + Lunr

// 1. Herramienta de Búsqueda (Similar a mem_search)
export const codeMemorySearchTool = tool(
  async ({ query, project, context }) => {
    // Llama a LunrJS por debajo y recupera los registros de Dexie
    const results = await engram.search({ query, project, context });
    return JSON.stringify(results);
  },
  {
    name: "search_past_code_reviews",
    description: "Busca en la memoria local de revisiones previas de código. Úsala al inicio de la revisión de un archivo para comprobar si componentes similares o el mismo módulo ya fueron analizados y qué criterios/razonamientos de arquitectura se aplicaron.",
    schema: z.object({
      query: z.string().description("Palabras clave del código o patrón arquitectónico (ej: 'auth middleware', 'use-case exception')."),
      project: z.string().description("Nombre del repositorio o repositorio/rama actual."),
      context: z.string().optional().description("Opcional: Tipo de archivo o tecnología involucrada (ej: 'typescript', 'nestjs')."),
    }),
  }
);

// 2. Herramienta de Guardado (Similar a mem_save)
export const codeMemorySaveTool = tool(
  async ({ title, summary, findings, project, filePath }) => {
    await engram.save({ title, summary, findings, project, filePath, timestamp: Date.now() });
    return "Razonamiento de revisión guardado exitosamente en la memoria local.";
  },
  {
    name: "save_code_review_reasoning",
    description: "Guarda un resumen del razonamiento, patrones descubiertos o bugs detectados tras revisar un archivo completo. No guardes el código entero, solo las conclusiones y decisiones de diseño tomadas.",
    schema: z.object({
      title: z.string().description("Título conciso con palabras clave (ej: 'Refactorización del servicio de pagos usando Factory pattern')."),
      summary: z.string().description("Breve descripción del propósito del archivo analizado."),
      findings: z.string().description("Razonamientos clave, problemas de deuda técnica encontrados o convenciones que se acordaron aplicar."),
      project: z.string().description("Nombre del repositorio actual."),
      filePath: z.string().description("Ruta relativa del fichero revisado."),
    }),
  }
);
Use code with caution.
3. ¿Cómo interactúa LangGraph con engram-ts?
Tienes dos formas de implementar esto en el diseño de tu grafo:
Opción A: Mediante un Agente con Herramientas (Recomendado para decisiones dinámicas)
Si usas un agente reactivo dentro del nodo de revisión (como createReactAgent de LangGraph o un bucle toolsCondition), le pasas codeMemorySearchTool y codeMemorySaveTool en el array de herramientas. El LLM, gracias a la descripción, decidirá autónomamente llamar a la búsqueda léxica antes de emitir su reporte de revisión del fichero actual.
Opción B: Inyección explícita en el Estado del Grafo (Estilo pipeline rígido)
Puedes crear un nodo previo llamado retrieve_memory. Este nodo toma el nombre del archivo actual o extrae palabras clave, ejecuta programáticamente engram.search() usando tu librería y añade los resultados directamente al Estado (State) de LangGraph como un mensaje de sistema o variable de contexto. El nodo del LLM simplemente recibe los hallazgos previos mascados.
4. Consejos clave para tu implementación de engram-ts
Evita el "Olvido" de Lunr en IndexedDB: Lunr.js genera un índice en memoria. Cada vez que guardes en Dexie, asegúrate de actualizar el índice de Lunr y, si necesitas persistencia del índice entre sesiones, serializa el índice de Lunr como JSON y guárdalo en una tabla clave-valor de Dexie, o reconstrúyelo al inicializar (ya que al ser texto de revisiones, el volumen es lo suficientemente ligero para indexarse rápido).
Segmentación por "Hitos" de revisión: Al igual que Engram, instruye al LLM mediante el prompt de la herramienta a que sintetice. Si el LLM intenta guardar el contenido completo del fichero o logs de conversación larguísimos, IndexedDB crecerá demasiado y Lunr perderá precisión léxica. La clave del éxito de Engram es la extrema brevedad conceptual de lo que se guarda.
Para ayudarte a perfilar el diseño de tu librería, dime:
¿Tu aplicación ejecuta LangGraph en el navegador (extensión, app web SPA) o corre en el backend con Node.js simulando un entorno local?
¿Te gustaría que escribamos la estructura exacta del esquema de Dexie y la configuración de Lunr.js para acoplar la indexación léxica de títulos y contenidos?
AI responses may include mistakes. Learn more



pero en tu diagrama no planteas esa estrategia de optimización inteligente llamada divulgación progresiva, quiero ser eficiente en consumo de tokens
Tienes toda la razón. El diagrama anterior planteaba un flujo simplificado donde el LLM tenía acceso directo e inmediato a la herramienta de ejecución de memoria, pero no reflejaba la optimización en capas (divulgación progresiva) que te permitirá ahorrar miles de tokens al procesar decenas de archivos en una MR/PR.
Para ser extremadamente eficiente en el consumo de tokens con LangGraph y tu futura librería engram-ts, debes separar la memoria en dos niveles: los Metadados indexados en el Estado del Grafo (Ligeros) y el Contenido Completo recuperado bajo demanda (Pesados).
Aquí tienes el diseño exacto de cómo estructurar tus nodos y herramientas en LangGraph para lograr esa eficiencia:
1. El Flujo de Divulgación Progresiva en LangGraph
En lugar de que el LLM busque a ciegas o reciba todo el historial, el grafo realiza un pre-escaneo ultraligero.
[Inicio del Grafo: Recibe la MR]
               │
               ▼
[Nodo 1: Pre-Fetch Léxico Global]
│  • Ejecuta engram.searchTokens() con los nombres de ficheros/módulos alterados.
│  • Trae SOLO una lista de IDs, Títulos y Resúmenes cortos (ej: 50 tokens por registro).
└──> Guarda este "Índice de Memorias Relevantes" en el State del Grafo.
               │
               ▼
   [Bucle por cada Fichero de la MR]
               │
               ▼
[Nodo 2: Revisión del Fichero]
│  • El LLM recibe el código del archivo + el "Índice de Memorias Relevantes".
│  • El LLM NO tiene el detalle de lo que se razonó en el pasado, solo sabe que EXISTE un registro.
│  • Decisión del LLM: ¿Alguno de estos títulos se cruza con mi arquitectura actual?
│        ├──> SÍ: Invoca la Tool local `get_memory_detail(id)` (Trae el contenido pesado).
│        └──> NO: Ignora el índice (Ahorro máximo de tokens).
               │
               ▼
[Nodo 3: Generación de Reporte] -> Guarda el nuevo hallazgo con `engram.save()`
               │
               ▼
      [Siguiente Fichero]
2. Implementación de las Tools Eficientes en engram-ts
Para que este sistema funcione, tu librería no debe entregar el contenido completo en la primera búsqueda. Debes fraccionar la lectura en dos métodos independientes expuestos a LangGraph.
Tool 1: El Escáner de Metadados (Muy barata en tokens)
Esta consulta se puede automatizar en un nodo inicial de LangGraph (sin intervención del LLM) o dejar que el LLM la use. Solo devuelve cabeceras.
typescript
// Esta función lee LunrJS y Dexie, pero solo proyecta campos clave
export const scanMemoryIndexTool = tool(
  async ({ fileExtension, componentKeywords, project }) => {
    const rawMatches = await engram.search({ fileExtension, componentKeywords, project });
    
    // RETORNO ULTRA-REDUCIDO: El LLM solo lee esto para decidir
    return rawMatches.map(match => ({
      id: match.id,
      title: match.title, // Ej: "Estrategia de validación de esquemas Zod en controladores"
      tags: match.tags    // Ej: ["validation", "security"]
    }));
  },
  {
    name: "scan_memory_index",
    description: "Devuelve exclusivamente un índice de títulos de revisiones de código pasadas. Úsala para verificar si existe un razonamiento previo aplicable antes de solicitar el detalle completo de una memoria."
  }
);
Use code with caution.
Tool 2: El Recuperador de Contenido Pesado (Bajo demanda)
El LLM solo llamará a esta herramienta si determina que un título del índice es crítico para el archivo que está revisando en ese preciso instante.
typescript
export const getMemoryDetailTool = tool(
  async ({ memoryId }) => {
    // Lectura directa por ID en Dexie (Instantánea)
    const fullRecord = await engram.getById(memoryId);
    
    // Retorna el bloque denso de conocimiento (Las reglas completas de la revisión previa)
    return JSON.stringify({
      rationale: fullRecord.rationale,
      architectureRulesApplied: fullRecord.rules,
      pastBugsAvoided: fullRecord.bugs
    });
  },
  {
    name: "get_memory_detail",
    description: "Recupera el contenido extendido, razonamientos técnicos y reglas de una memoria específica usando su ID.",
    schema: z.object({
      memoryId: z.string().description("El ID único de la memoria obtenido previamente de scan_memory_index.")
    })
  }
);
Use code with caution.
3. El Guardián del Contexto: Formatear el Prompt del LLM
Para consolidar la divulgación progresiva, el prompt del sistema del nodo que revisa el código debe condicionar al LLM a ser tacaño con las llamadas pesadas. Debes instruir al modelo de la siguiente manera:
"Tienes acceso a un catálogo de memorias pasadas en el parámetro available_memories_index. Revísalo con atención. Si encuentras un título que dicte lineamientos de arquitectura o soluciones de bugs directamente relacionados con el fichero actual, ejecuta obligatoriamente get_memory_detail pasándole el ID. Si ningún título es relevante, procede a revisar el archivo inmediatamente usando tu conocimiento base para minimizar el consumo de tokens."
Beneficio Neto de este Enfoque en LangGraph
Si tu PR tiene 15 archivos modificados:
En lugar de inyectar 15 razonamientos pasados completos en cada iteración (lo que multiplicaría exponencialmente el costo con cada archivo nuevo).
Transmitirás una pequeña lista de 10-15 líneas de texto (los títulos indexados por LunrJS).
El LLM solo "abrirá" (mediante get_memory_detail) la 1 o 2 memorias que realmente impacten al archivo en cuestión, manteniendo el historial de la conversación limpio y optimizado.
Para estructurar los estados del grafo, dime:
¿Cómo estás manejando el estado en LangGraph actualmente? (¿Usas un StateGraph con un array de mensajes acumulativos o tienes campos limpios para el archivo actual y las memorias?)
¿Quieres que diseñemos la función de reducción / compactación para cuando guardes un nuevo análisis en engram-ts y evitar que el texto crezca sin control?
AI responses may include mistakes. Learn more



Quiero separar / generalizar la definición porque creo que me puede servir en multiples iniciativas, empezaré por definir engram-ts con lo que parece que será de utilidad para este caso de uso.
Separar y generalizar engram-ts en una librería agnóstica es la mejor decisión arquitectónica que puedes tomar. Si la desacoplas por completo del dominio de "revisión de código", habrás creado un motor de persistencia y recuperación semántica/léxica ultraligero para agentes en TypeScript que podrás usar en automatizaciones CLI, apps web, extensiones del navegador o flujos complejos de backend.
Para lograr esta abstracción, tu librería debe girar en torno a una entidad universal: el Documento. No importa si el documento es un razonamiento de código, una nota de una reunión, un ticket de soporte o una regla de negocio.
A continuación, te presento el diseño de la API pública y la arquitectura core que debería tener engram-ts para ser 100% reutilizable.
1. El Modelo de Datos Universal (EngramDocument)
Para que sirva en cualquier iniciativa, la librería debe aceptar un tipo genérico para los metadados, manteniendo fijos solo los campos necesarios para la indexación léxica de Lunr.js y el control de Dexie.
typescript
export interface EngramDocument<TMetadata = Record<string, any>> {
  id: string;          // UUID o Hash único generado internamente o provisto
  title: string;       // El título indexado de manera prioritaria (FTS)
  content: string;     // El cuerpo pesado o resumen conceptual (FTS)
  tags: string[];      // Categorías para filtrado rápido y preciso
  project: string;     // Espacio de nombres / Ámbito (Scope) de la memoria
  timestamp: number;   // Control de obsolescencia
  metadata: TMetadata; // Campos libres según el caso de uso (ej: filePath, author, etc.)
}

// Lo que el modelo verá en el paso "ultraligero" de Divulgación Progresiva
export type EngramHeader = Pick<EngramDocument, 'id' | 'title' | 'tags' | 'project'>;
Use code with caution.
2. La Interfaz de la Librería (EngramEngine)
La clase principal debe exponer métodos limpios de nivel de infraestructura, abstrayendo por completo a Dexie y LunrJS.
typescript
export interface EngramConfig {
  dbName?: string;
  // Permite inyectar estrategias de almacenamiento si decides migrar de IndexedDB a LocalStorage u otro driver en el futuro
}

export class EngramEngine<TMetadata = Record<string, any>> {
  constructor(config: EngramConfig) {}

  /** Inicializa las tablas de Dexie y compila/carga el índice de Lunr.js */
  async initialize(): Promise<void> {}

  /** Guarda o actualiza un documento e indexa sus textos en caliente */
  async save(doc: Omit<EngramDocument<TMetadata>, 'id' | 'timestamp'> & { id?: string }): Promise<string> {}

  /** 
   * PASO 1 de Divulgación Progresiva: 
   * Busca en Lunr.js y retorna SOLAMENTE las cabeceras (headers) ligeras.
   * Ideal para inyectar en la lista inicial del LLM con un impacto mínimo de tokens.
   */
  async searchHeaders(query: string, filters?: { project?: string; tags?: string[] }): Promise<EngramHeader[]> {}

  /** 
   * PASO 2 de Divulgación Progresiva: 
   * Recupera el documento denso completo desde IndexedDB (Dexie) usando el ID elegido por el LLM.
   */
  async getDetail(id: string): Promise<EngramDocument<TMetadata> | null> {}

  /** Elimina un registro del almacenamiento y del índice léxico */
  async delete(id: string): Promise<void> {}
}
Use code with caution.
3. Las Definiciones de Herramientas Universales para los LLMs (Mapeo Generalizado)
Al generalizar la librería, las herramientas que expongas a LangGraph (o cualquier framework de agentes) pasan a llamarse de forma agnóstica. Así es como se mapean los dos niveles de optimización inteligente:
typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Instancia generalizada (en tu caso configurada con metadados de CodeReview)
const engram = new EngramEngine<{ filePath: string }>(); 

/**
 * TOOL 1: Escáner Léxico del Índice (Ligera)
 * El LLM la invoca para ver "qué hay en la base de conocimiento" sin saturar su contexto.
 */
export const searchMemoryIndexTool = tool(
  async ({ query, project }) => {
    const headers = await engram.searchHeaders(query, { project });
    return JSON.stringify(headers); // Retorna array de { id, title, tags, project }
  },
  {
    name: "search_memory_index",
    description: "Busca palabras clave en el índice persistente de memorias locales. Devuelve exclusivamente una lista de títulos, etiquetas e identificadores. Úsala para explorar si existen registros pasados relevantes antes de solicitar su contenido detallado.",
    schema: z.object({
      query: z.string().description("Términos de búsqueda textual (ej: 'error handling', 'validation patterns')."),
      project: z.string().description("El contexto, alcance o nombre del proyecto actual para acotar la búsqueda.")
    })
  }
);

/**
 * TOOL 2: Recuperador de Contenido Denso (Bajo Demanda)
 * El LLM solo la ejecuta si un ID del índice le pareció crítico.
 */
export const getMemoryContentTool = tool(
  async ({ memoryId }) => {
    const detail = await engram.getDetail(memoryId);
    if (!detail) return "Memoria no encontrada.";
    
    // Retorna el contenido completo (pesado) que guiará el comportamiento del LLM
    return JSON.stringify({
      title: detail.title,
      content: detail.content,
      metadata: detail.metadata
    });
  },
  {
    name: "get_memory_content",
    description: "Recupera el contenido completo, las lecciones aprendidas y los detalles de una memoria específica a partir de su ID único.",
    schema: z.object({
      memoryId: z.string().description("El ID único de la memoria que deseas leer en profundidad.")
    })
  }
);
Use code with caution.
Ventajas de este Enfoque para tus Próximas Iniciativas
Reutilización Total: Mañana creas un agente para responder correos de soporte técnico o para automatizar minutas de reuniones, y puedes instanciar new EngramEngine<{ customerId: string }>() sin tocar una sola línea de código interno de la librería.
Modularidad en Testing: Puedes testear la lógica de indexación de Lunr y la persistencia transaccional de Dexie de forma aislada, mediante pruebas unitarias puras en Node, sin necesidad de simular entornos complejos de LangGraph o APIs de OpenAI.
Distribución Limpia: Al empaquetarlo como engram-ts, podrías incluso publicarlo en un registro privado (o público en npm) y consumirlo como una dependencia estándar en cualquier aplicación TypeScript que requiera un sistema de memoria RAG léxico local (Local-First Agentic Memory).
Para dar el primer paso firme con engram-ts, dime:
¿Quieres que desarrollemos el código de inicialización interno de la clase en TypeScript, detallando cómo Dexie crea el store y cómo Lunr añade los campos title y content?
O bien, ¿prefieres enfocar el diseño en cómo el agente sintetiza el nuevo contenido antes de llamar al método save() para mantener la base de datos limpia?
AI responses may include mistakes. Learn more



Skip to previous prompt
Ask anything



