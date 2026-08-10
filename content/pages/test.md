---
title: Тестова сторінка
full_title: Тестова сторінка — усі блоки сайту
slug: test
seo_description: Службова сторінка для перевірки вигляду всіх блоків. Не для відвідувачів.
blocks:
  - type: notice
    heading: ОГОЛОШЕННЯ
    text: >-
      Це **службова сторінка**. Тут зібрані всі блоки, які можна додати на будь-яку
      сторінку сайту, — щоб подивитися, як кожен виглядає. Відвідувачам вона не
      потрібна: у меню її немає.
  - type: text
    text: |-
      ## Блок «Текст»

      Звичайний текст із розміткою: **жирний**, *курсив*, [посилання](/novyny).

      - перший пункт списку
      - другий пункт
      - третій пункт

      | Стовпець А | Стовпець Б |
      | --- | --- |
      | значення 1 | значення 2 |
      | значення 3 | значення 4 |
  - type: accordion
    title: Блок «Розділ» — розгортається кліком
    text: >-
      Усередині розділу теж працює розмітка. Такі розділи зручні для довгих
      пояснень, які не мають займати екран одразу.
  - type: cards
    title: Блок «Картки-посилання»
    items:
      - label: Новини Центру
        text: Усі публікації за роками
        url: /novyny
        icon: calendar
      - label: Наша команда
        text: Працівники Центру
        url: /komanda
        icon: people
      - label: Облік сертифікатів
        text: Переліки виданих документів
        url: /oblik-sertyfikativ
        icon: award
      - label: Плани роботи
        text: Заходи по місяцях
        url: /plany-roboty
        icon: book
      - label: МОН України
        text: Офіційний сайт міністерства
        url: https://mon.gov.ua
        icon: link
      - label: Картка без посилання
        text: Показує, що клацнути нікуди
        icon: document
  - type: steps
    title: Блок «Порядок дій»
    items:
      - label: Зателефонувати до Центру
        text: (05361)-77-416, у робочі години
      - label: Узгодити консультанта й час
        text: Підкажемо, хто веде ваш напрям
      - label: Прийти на консультацію
        text: вул. Григора Тютюнника 19А
  - type: cta
    heading: Блок «Смуга із кнопкою»
    text: Використовується для запису, реєстрації чи переходу на форму.
    button_label: Записатися
    url: /kontakty
  - type: video
    title: Блок «Відео з YouTube»
    url: https://www.youtube.com/watch?v=aqz-KE-bpKQ
    caption: Підпис під відео — необов'язковий
  - type: embed
    title: Блок «Форма або мапа на сторінці»
    url: https://docs.google.com/forms/d/e/1FAIpQLSe90XkKQi14eHPzo1ylzHyy2_qIr8E_oRblPg7QMz3PImK7QQ/viewform
    height: tall
    note: Це справжня форма запису Центру — заповнюється не виходячи із сайту.
  - type: gallery
    title: Блок «Фотогалерея»
    images:
      - image: /images/team/komanda.jpg
        caption: Колектив Центру
      - image: /images/team/pedoriaka.jpg
        caption: Оксана Педоряка
      - image: /images/team/lisna.jpg
        caption: Світлана Лісна
      - image: /images/team/taranets.jpg
        caption: Альона Таранець
  - type: news_list
    title: Блок «Список новин» — обрані вручну
    items:
      - 2026-06-26-intensyv-z-pidhotovky-nastavnykiv
      - 2026-06-18-zavershennia-proiektu-perezavantazhennia-nush-1-4-klasy
      - 2026-06-18-novi-znannia-zadlia-bezpeky-ditei-fakhivtsi-tsprpp-na-treninhu-z-protydii-nasyls
  - type: news_by_topic
    title: Блок «Новини за темою» — збирається сам
    topic: doshkillia
    open: true
    extra: Заходи, перелік яких ще не опубліковано, показуються окремим списком.
  - type: documents
    title: Блок «Документи»
    intro: Посилання на файли, сторінки або новини — з нумерацією і вкладеними пунктами.
    view: open
    numbered: true
    items:
      - label: Зовнішній документ (сайт МОН)
        url: https://mon.gov.ua
      - label: Новина зі списку публікацій
        news: 2026-06-26-intensyv-z-pidhotovky-nastavnykiv
      - label: Пункт із вкладеними документами
        children:
          - label: Вкладений пункт 1
            url: /novyny
          - label: Вкладений пункт 2
            url: /komanda
  - type: table
    title: Блок «Таблиця»
    view: open
    columns:
      - Заклад освіти
      - Прізвище, ім'я, по батькові
      - Посада
      - Телефон
    fields:
      - institution
      - person
      - role
      - phone
    entries:
      - institution: ЦПРПП м. Лубни
        person: Педоряка Оксана Іванівна
        role: Директор
        phone: (05361)-77-416
      - institution: ЦПРПП м. Лубни
        person: Лісна Світлана Григорівна
        role: Консультант
        phone: (05361)-77-421
      - note: Рядок на всю ширину — для підписів під таблицею
  - type: certificates
    title: Блок «Облік сертифікатів»
    intro: Список збирається автоматично з розділу «Облік сертифікатів».
  - type: plans
    intro: 'Блок «Плани роботи»: роки збираються самі з розділу «Плани роботи».'
  - type: partners
    title: Блок «Логотипи партнерів»
    items:
      - name: Міністерство юстиції України
        image: /images/pict/coop/minjust2.png
        url: https://minjust.gov.ua/
      - name: Ла Страда – Україна
        image: /images/pict/coop/lastrada2.png
        url: https://la-strada.org.ua/
      - name: Державна служба якості освіти
        image: /images/pict/coop/dsyau2.png
        url: https://sqe.gov.ua/
---
