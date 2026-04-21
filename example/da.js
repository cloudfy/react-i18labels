// @generated — do not edit. Run `i18n compile` to regenerate.
// Locale: da  |  Total: 18  |  Missing: 0

export default {
  "Settings": "Indstillinger",
  "Manage your account preferences": "Administrer dine kontopræferencer",
  "Hello, {name}!": (v)=>`Hej, ${v.name}!`,
  "You have {count, plural, one {# item} other {# items}} in your cart": (v,_pf)=>`Du har ${_pf(v.count,"da",0,"one","# vare","other","# varer")} i din indkøbskurv`,
  "{count, plural, =0 {No friends yet — invite someone!} =1 {Just you for now} one {# friend} other {# friends}}": (v,_pf)=>`${_pf(v.count,"da",0,"=0","Ingen venner endnu — invitér nogen!","=1","Bare dig for nu","one","# ven","other","# venner")}`,
  "{gender, select, male {He updated his profile} female {She updated her profile} other {They updated their profile}}": (v)=>`${((v)=>{switch(v.gender){case "male":return`Han opdaterede sin profil`;case "female":return`Hun opdaterede sin profil`;default:return`De opdaterede deres profil`;}})(v)}`,
  "By continuing you agree to {link}our {bold}Terms of Service{/bold}{/link}": "Ved at fortsætte accepterer du vores {link}brugsbetingelser{/link}",
  "This field is required": "Dette felt er påkrævet",
  "Please enter a valid email address": "Angiv venligst en gyldig e-mailadresse",
  "Book": "Reservér",
};
