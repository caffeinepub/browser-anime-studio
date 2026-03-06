import Text "mo:core/Text";

actor {
  public shared ({ caller }) func greet(name : Text) : async Text {
    "Hello, " # name # "! Welcome to your Anime Studio.";
  };
};
