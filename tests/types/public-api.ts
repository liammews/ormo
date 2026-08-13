import * as Accordion from "@ormo/primitives/accordion";
import * as AlertDialog from "@ormo/primitives/alert-dialog";
import * as Autocomplete from "@ormo/primitives/autocomplete";
import * as Avatar from "@ormo/primitives/avatar";
import * as Breadcrumbs from "@ormo/primitives/breadcrumbs";
import * as Button from "@ormo/primitives/button";
import * as Checkbox from "@ormo/primitives/checkbox";
import * as CheckboxGroup from "@ormo/primitives/checkbox/group";
import * as Combobox from "@ormo/primitives/combobox";
import * as Dialog from "@ormo/primitives/dialog";
import * as Field from "@ormo/primitives/field";
import * as Fieldset from "@ormo/primitives/fieldset";
import * as Input from "@ormo/primitives/input";
import * as PasswordField from "@ormo/primitives/password-field";
import * as Popover from "@ormo/primitives/popover";
import * as Radio from "@ormo/primitives/radio";
import * as RadioGroup from "@ormo/primitives/radio/group";
import * as Select from "@ormo/primitives/select";
import * as Separator from "@ormo/primitives/separator";
import * as Switch from "@ormo/primitives/switch";
import * as Tabs from "@ormo/primitives/tabs";
import * as Tooltip from "@ormo/primitives/tooltip";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;
type Keys<Module> = keyof Module;

export type PublicComponentContract = [
  Assert<
    Equal<
      Keys<typeof Accordion>,
      "Content" | "Header" | "Item" | "Root" | "Trigger"
    >
  >,
  Assert<
    Equal<
      Keys<typeof AlertDialog>,
      | "Action"
      | "Cancel"
      | "Content"
      | "Description"
      | "Root"
      | "Title"
      | "Trigger"
    >
  >,
  Assert<
    Equal<
      Keys<typeof Autocomplete>,
      | "Clear"
      | "Content"
      | "Empty"
      | "Group"
      | "GroupLabel"
      | "Input"
      | "Item"
      | "Loading"
      | "Root"
      | "Separator"
    >
  >,
  Assert<Equal<Keys<typeof Avatar>, "Fallback" | "Image" | "Root">>,
  Assert<
    Equal<
      Keys<typeof Breadcrumbs>,
      "Item" | "Link" | "List" | "Page" | "Root" | "Separator"
    >
  >,
  Assert<Equal<Keys<typeof Button>, "Button" | "setButtonState">>,
  Assert<Equal<Keys<typeof Checkbox>, "Checkbox" | "CheckboxIndicator">>,
  Assert<Equal<Keys<typeof CheckboxGroup>, "Label" | "Root">>,
  Assert<
    Equal<
      Keys<typeof Combobox>,
      | "Clear"
      | "Content"
      | "Empty"
      | "Group"
      | "GroupLabel"
      | "Icon"
      | "Input"
      | "Item"
      | "ItemIndicator"
      | "Root"
      | "Separator"
      | "Toggle"
    >
  >,
  Assert<
    Equal<
      Keys<typeof Dialog>,
      "Close" | "Content" | "Description" | "Root" | "Title" | "Trigger"
    >
  >,
  Assert<
    Equal<
      Keys<typeof Field>,
      "Control" | "Description" | "Error" | "Label" | "Root"
    >
  >,
  Assert<Equal<Keys<typeof Fieldset>, "Legend" | "Root">>,
  Assert<Equal<Keys<typeof Input>, "Input">>,
  Assert<Equal<Keys<typeof PasswordField>, "Input" | "Root" | "Toggle">>,
  Assert<
    Equal<
      Keys<typeof Popover>,
      "Close" | "Content" | "Description" | "Root" | "Title" | "Trigger"
    >
  >,
  Assert<Equal<Keys<typeof Radio>, "Radio" | "RadioIndicator">>,
  Assert<Equal<Keys<typeof RadioGroup>, "Label" | "Root">>,
  Assert<
    Equal<
      Keys<typeof Select>,
      | "Clear"
      | "Content"
      | "Group"
      | "GroupLabel"
      | "Icon"
      | "Item"
      | "ItemIndicator"
      | "Root"
      | "Separator"
      | "Trigger"
      | "Value"
    >
  >,
  Assert<Equal<Keys<typeof Separator>, "Separator">>,
  Assert<Equal<Keys<typeof Switch>, "Root" | "Thumb">>,
  Assert<Equal<Keys<typeof Tabs>, "List" | "Panel" | "Root" | "Tab">>,
  Assert<Equal<Keys<typeof Tooltip>, "Content" | "Root" | "Trigger">>,
];
